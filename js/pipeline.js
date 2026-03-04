// ══════════════════════════════════════════════════════════════
// Pipeline Board — Client-Side Engine (Hybrid View)
// 4 Active Columns + Enviados Summary & Table
// Drag & Drop · SSE Real-time · Card Modal · Labels · Comments
// ══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const ACTIVE_STAGES = ['inbox', 'separada', 'cotacao', 'revisao'];
    const ALL_STAGES = ['inbox', 'separada', 'cotacao', 'revisao', 'enviados'];
    const USERS = window.__PIPELINE_USERS__ || [];
    const CURRENT_USER = window.__CURRENT_USER__ || {};

    let allCards = [];     // Active stage cards only
    let allLabels = [];
    let activeCardId = null;
    let draggedCardId = null;

    // Enviados table state
    let enviadosState = { page: 1, sortBy: 'updated_at', sortDir: 'desc', search: '', outcome: '', assignee: '' };

    // ── Init ──
    document.addEventListener('DOMContentLoaded', () => {
        loadCards();
        loadLabels();
        loadEnviadosStats();
        loadEnviados();
        connectSSE();
        setupFilters();
        setupEnviadosFilters();
        setupMentionAutocomplete();
    });

    // ══════════════════════════════════════════════════════════
    // DATA LOADING
    // ══════════════════════════════════════════════════════════

    async function loadCards() {
        try {
            const res = await fetch('/api/pipeline/cards');
            const data = await res.json();
            allCards = data.cards || [];
            renderBoard();
        } catch (e) {
            console.error('Failed to load cards:', e);
        }
    }

    async function loadLabels() {
        try {
            const res = await fetch('/api/pipeline/labels');
            const data = await res.json();
            allLabels = data.labels || [];
            populateLabelFilters();
        } catch (e) {
            console.error('Failed to load labels:', e);
        }
    }

    async function loadEnviadosStats() {
        try {
            const res = await fetch('/api/pipeline/enviados/stats');
            const data = await res.json();
            document.getElementById('glanceTotalNum').textContent = data.total;
            document.getElementById('glancePendingNum').textContent = data.pending;
            document.getElementById('glanceWonNum').textContent = data.won;
            document.getElementById('glanceLostNum').textContent = data.lost;
            document.getElementById('count-enviados').textContent = data.total;
        } catch (e) {
            console.error('Failed to load enviados stats:', e);
        }
    }

    async function loadEnviados() {
        const s = enviadosState;
        const params = new URLSearchParams({
            page: String(s.page),
            sortBy: s.sortBy,
            sortDir: s.sortDir,
        });
        if (s.search) params.set('search', s.search);
        if (s.outcome) params.set('outcome', s.outcome);
        if (s.assignee) params.set('assignee', s.assignee);

        try {
            const res = await fetch(`/api/pipeline/enviados?${params}`);
            const data = await res.json();
            renderEnviadosTable(data.rows, data.page, data.totalPages, data.totalCount);
        } catch (e) {
            console.error('Failed to load enviados:', e);
        }
    }

    // ══════════════════════════════════════════════════════════
    // BOARD RENDERING (4 active columns only)
    // ══════════════════════════════════════════════════════════

    function renderBoard() {
        const searchTerm = document.getElementById('filterSearch')?.value?.toLowerCase() || '';
        const filterAssignee = document.getElementById('filterAssignee')?.value || '';
        const filterLabel = document.getElementById('filterLabel')?.value || '';

        ACTIVE_STAGES.forEach(stage => {
            const body = document.querySelector(`.column-body[data-stage="${stage}"]`);
            if (!body) return;

            const stageCards = allCards
                .filter(c => c.stage === stage)
                .filter(c => {
                    if (searchTerm && !c.titulo.toLowerCase().includes(searchTerm)) return false;
                    if (filterAssignee && String(c.assigned_to) !== filterAssignee) return false;
                    if (filterLabel && !c.labels.some(l => String(l.id) === filterLabel)) return false;
                    return true;
                })
                .sort((a, b) => a.position - b.position);

            body.innerHTML = stageCards.map(c => renderCard(c)).join('');

            const countEl = document.getElementById(`count-${stage}`);
            if (countEl) countEl.textContent = stageCards.length;
        });
    }

    function renderCard(card) {
        const urgencyClass = getUrgencyClass(card.deadline);
        const assignee = card.assignee;
        const initials = assignee
            ? (assignee.nome_completo || assignee.username || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
            : '';

        const labelsHtml = card.labels.map(l =>
            `<span class="label-pill" style="background:${l.color}20; color:${l.color}; border-color:${l.color}40">${l.name}</span>`
        ).join('');

        const deadlineHtml = card.deadline
            ? `<span class="deadline-badge ${urgencyClass}"><i class="fas fa-clock"></i> ${formatDeadline(card.deadline)}</span>`
            : '';

        const outcomeHtml = card.outcome === 'won'
            ? '<span class="outcome-indicator outcome-won-indicator">🏆</span>'
            : card.outcome === 'lost'
                ? '<span class="outcome-indicator outcome-lost-indicator">❌</span>'
                : '';

        const metaHtml = [];
        if (card.item_count > 0) metaHtml.push(`<span class="card-meta-item"><i class="fas fa-list"></i> ${card.item_count}</span>`);
        if (card.comment_count > 0) metaHtml.push(`<span class="card-meta-item"><i class="fas fa-comment"></i> ${card.comment_count}</span>`);

        return `
        <div class="pipeline-card ${urgencyClass}" data-id="${card.id}"
             draggable="true"
             ondragstart="handleDragStart(event, ${card.id})"
             ondragend="handleDragEnd(event)"
             onclick="openCardModal(${card.id})">
            ${labelsHtml ? `<div class="card-labels">${labelsHtml}</div>` : ''}
            <div class="card-title">${escapeHtml(card.titulo)} ${outcomeHtml}</div>
            ${card.solicitante_nome ? `<div class="card-solicitante">${escapeHtml(card.solicitante_nome)}</div>` : ''}
            <div class="card-footer">
                <div class="card-meta">${deadlineHtml}${metaHtml.join('')}</div>
                ${assignee ? `<div class="card-avatar" title="${escapeHtml(assignee.nome_completo || assignee.username)}">${initials}</div>` : ''}
            </div>
        </div>`;
    }

    // ══════════════════════════════════════════════════════════
    // ENVIADOS TABLE RENDERING
    // ══════════════════════════════════════════════════════════

    function renderEnviadosTable(rows, page, totalPages, totalCount) {
        const tbody = document.getElementById('enviadosBody');

        if (rows.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Nenhuma cotação enviada encontrada.</td></tr>';
            document.getElementById('enviadosPagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const assigneeName = r.assignee
                ? (r.assignee.nome_completo || r.assignee.username)
                : '—';

            const labelsHtml = r.labels.map(l =>
                `<span class="label-pill" style="background:${l.color}20; color:${l.color}; border-color:${l.color}40">${l.name}</span>`
            ).join(' ');

            const deadlineStr = r.deadline
                ? new Date(r.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                : '—';

            const updatedStr = r.updated_at
                ? new Date(r.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                : '—';

            let outcomeBadge = '<span class="outcome-badge outcome-badge-pending">⏳ Aguardando</span>';
            if (r.outcome === 'won') outcomeBadge = '<span class="outcome-badge outcome-badge-won">🏆 Vencemos</span>';
            if (r.outcome === 'lost') outcomeBadge = '<span class="outcome-badge outcome-badge-lost">❌ Perdemos</span>';

            return `
            <tr class="enviados-row" onclick="openCardModal(${r.id})" data-id="${r.id}">
                <td class="col-titulo">${escapeHtml(r.titulo)}</td>
                <td class="col-solicitante">${escapeHtml(r.solicitante_nome || '—')}</td>
                <td class="col-assignee">${escapeHtml(assigneeName)}</td>
                <td class="col-labels">${labelsHtml || '—'}</td>
                <td class="col-deadline">${deadlineStr}</td>
                <td class="col-updated">${updatedStr}</td>
                <td class="col-outcome">${outcomeBadge}</td>
                <td class="col-actions">
                    <a href="/orcamentos/form?id=${r.id}" class="table-action-btn" title="Editar" onclick="event.stopPropagation();">
                        <i class="fas fa-edit"></i>
                    </a>
                </td>
            </tr>`;
        }).join('');

        // Pagination
        renderPagination(page, totalPages, totalCount);
    }

    function renderPagination(page, totalPages, totalCount) {
        const container = document.getElementById('enviadosPagination');
        if (totalPages <= 1) {
            container.innerHTML = `<span class="pagination-info">${totalCount} registro${totalCount !== 1 ? 's' : ''}</span>`;
            return;
        }

        let html = `<span class="pagination-info">${totalCount} registros · Página ${page} de ${totalPages}</span>`;
        html += '<div class="pagination-buttons">';

        if (page > 1) {
            html += `<button class="pagination-btn" onclick="goToEnviadosPage(${page - 1})"><i class="fas fa-chevron-left"></i></button>`;
        }

        // Show page numbers
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);
        for (let i = start; i <= end; i++) {
            html += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="goToEnviadosPage(${i})">${i}</button>`;
        }

        if (page < totalPages) {
            html += `<button class="pagination-btn" onclick="goToEnviadosPage(${page + 1})"><i class="fas fa-chevron-right"></i></button>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    window.goToEnviadosPage = function (page) {
        enviadosState.page = page;
        loadEnviados();
    };

    window.sortEnviados = function (field) {
        if (enviadosState.sortBy === field) {
            enviadosState.sortDir = enviadosState.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
            enviadosState.sortBy = field;
            enviadosState.sortDir = 'desc';
        }
        enviadosState.page = 1;

        // Update sort icons
        document.querySelectorAll('.enviados-table th').forEach(th => {
            th.classList.remove('active-sort');
            const icon = th.querySelector('.sort-icon');
            if (icon) icon.className = 'fas fa-sort sort-icon';
        });

        const activeTh = document.querySelector(`th[data-sort="${field}"]`);
        if (activeTh) {
            activeTh.classList.add('active-sort');
            const icon = activeTh.querySelector('.sort-icon');
            if (icon) icon.className = `fas fa-sort-${enviadosState.sortDir === 'desc' ? 'down' : 'up'} sort-icon`;
        }

        loadEnviados();
    };

    function setupEnviadosFilters() {
        document.getElementById('enviadosSearch')?.addEventListener('input', debounce(() => {
            enviadosState.search = document.getElementById('enviadosSearch').value;
            enviadosState.page = 1;
            loadEnviados();
        }, 300));

        document.getElementById('enviadosOutcome')?.addEventListener('change', () => {
            enviadosState.outcome = document.getElementById('enviadosOutcome').value;
            enviadosState.page = 1;
            loadEnviados();
        });

        document.getElementById('enviadosAssignee')?.addEventListener('change', () => {
            enviadosState.assignee = document.getElementById('enviadosAssignee').value;
            enviadosState.page = 1;
            loadEnviados();
        });
    }

    // ══════════════════════════════════════════════════════════
    // DRAG & DROP
    // ══════════════════════════════════════════════════════════

    window.handleDragStart = function (e, cardId) {
        draggedCardId = cardId;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cardId);
    };

    window.handleDragEnd = function (e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.column-body').forEach(el => el.classList.remove('drag-over'));
        draggedCardId = null;
    };

    window.handleDragOver = function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    };

    window.handleDragLeave = function (e) {
        e.currentTarget.classList.remove('drag-over');
    };

    window.handleDrop = async function (e, targetStage) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const cardId = Number.parseInt(e.dataTransfer.getData('text/plain'));
        if (!cardId) return;

        const card = allCards.find(c => c.id === cardId);
        if (!card || card.stage === targetStage) return;

        const oldStage = card.stage;

        if (targetStage === 'enviados') {
            // Moving to Enviados — remove from active cards, update server
            allCards = allCards.filter(c => c.id !== cardId);
            renderBoard();
        } else {
            // Moving between active stages
            card.stage = targetStage;
            const targetCards = allCards.filter(c => c.stage === targetStage && c.id !== cardId);
            card.position = targetCards.length;
            renderBoard();
        }

        try {
            await fetch(`/api/pipeline/cards/${cardId}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: targetStage, position: 0 }),
            });

            if (targetStage === 'enviados') {
                loadEnviadosStats();
                loadEnviados();
            } else if (oldStage === 'enviados') {
                loadEnviadosStats();
                loadEnviados();
            }

            // Reorder within target stage
            if (targetStage !== 'enviados') {
                const orderedIds = allCards
                    .filter(c => c.stage === targetStage)
                    .sort((a, b) => a.position - b.position)
                    .map(c => c.id);

                await fetch('/api/pipeline/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cardIds: orderedIds, stage: targetStage }),
                });
            }
        } catch (err) {
            card.stage = oldStage;
            loadCards();
            console.error('Move failed:', err);
        }
    };

    // ══════════════════════════════════════════════════════════
    // SSE REAL-TIME
    // ══════════════════════════════════════════════════════════

    function connectSSE() {
        const es = new EventSource('/api/pipeline/stream');

        es.addEventListener('card_moved', (e) => {
            const data = JSON.parse(e.data);
            if (data.movedBy === CURRENT_USER.username) return;
            loadCards();
            loadEnviadosStats();
            loadEnviados();
        });

        es.addEventListener('card_updated', () => {
            loadCards();
            loadEnviadosStats();
            loadEnviados();
        });

        es.addEventListener('card_assigned', (e) => {
            const data = JSON.parse(e.data);
            const card = allCards.find(c => c.id === data.cardId);
            if (card) {
                card.assigned_to = data.user_id;
                card.assignee = data.user_id
                    ? USERS.find(u => u.id === data.user_id) || null
                    : null;
                renderBoard();
            }
            loadEnviados();
        });

        es.addEventListener('card_label_added', () => { loadCards(); loadEnviados(); });
        es.addEventListener('card_label_removed', () => { loadCards(); loadEnviados(); });
        es.addEventListener('label_created', () => loadLabels());
        es.addEventListener('label_updated', () => loadLabels());
        es.addEventListener('label_deleted', () => { loadLabels(); loadCards(); loadEnviados(); });
        es.addEventListener('comment_added', () => {
            if (activeCardId) loadComments(activeCardId);
        });

        es.onerror = () => {
            setTimeout(connectSSE, 3000);
            es.close();
        };
    }

    // ══════════════════════════════════════════════════════════
    // CARD MODAL
    // ══════════════════════════════════════════════════════════

    window.openCardModal = async function (cardId) {
        activeCardId = cardId;

        // Try active cards first, then fetch from server if it's an enviados card
        let card = allCards.find(c => c.id === cardId);
        if (!card) {
            // Fetch card details from API for enviados cards
            try {
                const res = await fetch('/api/pipeline/cards');
                const data = await res.json();
                card = (data.cards || []).find(c => c.id === cardId);
            } catch (e) {
                console.error('Failed to fetch card:', e);
                return;
            }
        }
        if (!card) return;

        document.getElementById('cardModal').style.display = 'flex';
        document.getElementById('modalTitle').textContent = card.titulo;
        document.getElementById('modalDescription').value = card.description || '';
        document.getElementById('btnSaveDesc').style.display = 'none';
        document.getElementById('modalAssignee').value = card.assigned_to || '';
        document.getElementById('modalDeadline').value = card.deadline
            ? new Date(card.deadline).toISOString().slice(0, 16)
            : '';

        // Outcome section — always visible for enviados
        const outcomeSection = document.getElementById('outcomeSection');
        if (card.stage === 'enviados') {
            outcomeSection.style.display = 'block';
            document.querySelectorAll('.outcome-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.outcome === (card.outcome || ''));
            });
        } else {
            outcomeSection.style.display = 'none';
        }

        document.getElementById('btnEditQuote').href = `/orcamentos/form?id=${cardId}`;
        renderModalLabels(card);
        loadComments(cardId);
    };

    window.closeCardModal = function () {
        document.getElementById('cardModal').style.display = 'none';
        activeCardId = null;
    };

    document.addEventListener('click', (e) => {
        if (e.target.id === 'cardModal') closeCardModal();
        if (e.target.id === 'labelManagerModal') closeLabelManager();
    });

    // ── Save Description ──
    window.saveDescription = async function () {
        if (!activeCardId) return;
        const desc = document.getElementById('modalDescription').value;
        await fetch(`/api/pipeline/cards/${activeCardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: desc }),
        });
        document.getElementById('btnSaveDesc').style.display = 'none';
        const card = allCards.find(c => c.id === activeCardId);
        if (card) card.description = desc;
    };

    window.assignUser = async function () {
        if (!activeCardId) return;
        const userId = document.getElementById('modalAssignee').value;
        await fetch(`/api/pipeline/cards/${activeCardId}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId ? Number(userId) : null }),
        });
        const card = allCards.find(c => c.id === activeCardId);
        if (card) {
            card.assigned_to = userId ? Number(userId) : null;
            card.assignee = userId ? USERS.find(u => u.id === Number(userId)) || null : null;
            renderBoard();
        }
        loadEnviados();
    };

    window.saveDeadline = async function () {
        if (!activeCardId) return;
        const val = document.getElementById('modalDeadline').value;
        await fetch(`/api/pipeline/cards/${activeCardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deadline: val || null }),
        });
        const card = allCards.find(c => c.id === activeCardId);
        if (card) {
            card.deadline = val || null;
            renderBoard();
        }
    };

    window.setOutcome = async function (outcome) {
        if (!activeCardId) return;
        await fetch(`/api/pipeline/cards/${activeCardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome }),
        });
        document.querySelectorAll('.outcome-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.outcome === outcome);
        });
        const card = allCards.find(c => c.id === activeCardId);
        if (card) card.outcome = outcome || null;
        renderBoard();
        loadEnviadosStats();
        loadEnviados();
    };

    window.generateQuotesFromModal = function () {
        if (!activeCardId) return;
        window.open(`/print?id=${activeCardId}&company_index=1`, '_blank');
        setTimeout(() => window.open(`/print?id=${activeCardId}&company_index=2`, '_blank'), 200);
        setTimeout(() => window.open(`/print?id=${activeCardId}&company_index=3`, '_blank'), 400);
    };

    // ══════════════════════════════════════════════════════════
    // LABELS
    // ══════════════════════════════════════════════════════════

    function renderModalLabels(card) {
        const container = document.getElementById('modalLabels');
        container.innerHTML = card.labels.map(l =>
            `<span class="label-pill label-pill-lg" style="background:${l.color}20; color:${l.color}; border-color:${l.color}40">
                ${l.name}
                <button class="label-remove" onclick="removeCardLabel(${card.id}, ${l.id}); event.stopPropagation();">×</button>
            </span>`
        ).join('');

        const select = document.getElementById('labelAddSelect');
        const assignedIds = new Set(card.labels.map(l => l.id));
        select.innerHTML = '<option value="">+ Adicionar...</option>';
        allLabels.filter(l => !assignedIds.has(l.id)).forEach(l => {
            select.innerHTML += `<option value="${l.id}" data-color="${l.color}">${l.name}</option>`;
        });
        select.onchange = () => {
            if (select.value) {
                addCardLabel(card.id, Number(select.value));
                select.value = '';
            }
        };
    }

    async function addCardLabel(cardId, labelId) {
        await fetch(`/api/pipeline/cards/${cardId}/labels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label_id: labelId }),
        });
        const label = allLabels.find(l => l.id === labelId);
        const card = allCards.find(c => c.id === cardId);
        if (card && label) {
            card.labels.push({ id: label.id, name: label.name, color: label.color });
            renderModalLabels(card);
            renderBoard();
        }
    }

    window.removeCardLabel = async function (cardId, labelId) {
        await fetch(`/api/pipeline/cards/${cardId}/labels/${labelId}`, { method: 'DELETE' });
        const card = allCards.find(c => c.id === cardId);
        if (card) {
            card.labels = card.labels.filter(l => l.id !== labelId);
            renderModalLabels(card);
            renderBoard();
        }
    };

    window.openLabelManager = function () {
        document.getElementById('labelManagerModal').style.display = 'flex';
        renderLabelManagerList();
    };

    window.closeLabelManager = function () {
        document.getElementById('labelManagerModal').style.display = 'none';
    };

    function renderLabelManagerList() {
        const container = document.getElementById('labelManagerList');
        container.innerHTML = allLabels.map(l =>
            `<div class="label-manager-item">
                <span class="label-pill label-pill-lg" style="background:${l.color}20; color:${l.color}; border-color:${l.color}40">${l.name}</span>
                <div class="label-manager-actions">
                    <input type="color" value="${l.color}" onchange="updateLabel(${l.id}, null, this.value)" class="label-color-input">
                    <button class="btn-icon btn-remove" onclick="deleteLabel(${l.id})" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </div>`
        ).join('');
    }

    window.createLabel = async function () {
        const name = document.getElementById('newLabelName').value.trim();
        const color = document.getElementById('newLabelColor').value;
        if (!name) return;

        const res = await fetch('/api/pipeline/labels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color }),
        });
        const data = await res.json();
        if (data.success) {
            allLabels.push(data.label);
            document.getElementById('newLabelName').value = '';
            renderLabelManagerList();
            populateLabelFilters();
        }
    };

    window.updateLabel = async function (id, name, color) {
        const label = allLabels.find(l => l.id === id);
        if (!label) return;

        await fetch(`/api/pipeline/labels/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name || label.name, color: color || label.color }),
        });
        if (name) label.name = name;
        if (color) label.color = color;
        renderLabelManagerList();
        populateLabelFilters();
        loadCards();
    };

    window.deleteLabel = async function (id) {
        if (!confirm('Excluir esta etiqueta?')) return;
        await fetch(`/api/pipeline/labels/${id}`, { method: 'DELETE' });
        allLabels = allLabels.filter(l => l.id !== id);
        renderLabelManagerList();
        populateLabelFilters();
        loadCards();
    };

    function populateLabelFilters() {
        const filterSelect = document.getElementById('filterLabel');
        const currentVal = filterSelect?.value || '';
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Todas as etiquetas</option>';
            allLabels.forEach(l => {
                filterSelect.innerHTML += `<option value="${l.id}">${l.name}</option>`;
            });
            filterSelect.value = currentVal;
        }
    }

    // ══════════════════════════════════════════════════════════
    // COMMENTS
    // ══════════════════════════════════════════════════════════

    async function loadComments(cardId) {
        const list = document.getElementById('commentsList');
        list.innerHTML = '<div class="comment-loading">Carregando...</div>';

        try {
            const res = await fetch(`/api/pipeline/cards/${cardId}/comments`);
            const data = await res.json();
            const cmnts = data.comments || [];

            if (cmnts.length === 0) {
                list.innerHTML = '<div class="comment-empty">Nenhum comentário ainda.</div>';
                return;
            }

            list.innerHTML = cmnts.map(c => renderComment(c)).join('');
        } catch (e) {
            list.innerHTML = '<div class="comment-empty">Erro ao carregar comentários.</div>';
        }
    }

    function renderComment(c) {
        const initials = (c.nome_completo || c.username || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const date = new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const bodyHtml = formatMentions(escapeHtml(c.body));

        return `
        <div class="comment-item" data-id="${c.id}">
            <div class="comment-avatar">${initials}</div>
            <div class="comment-content">
                <div class="comment-header">
                    <strong>${escapeHtml(c.nome_completo || c.username)}</strong>
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-body">${bodyHtml}</div>
            </div>
        </div>`;
    }

    window.submitComment = async function () {
        if (!activeCardId) return;
        const input = document.getElementById('commentInput');
        const body = input.value.trim();
        if (!body) return;

        await fetch(`/api/pipeline/cards/${activeCardId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body }),
        });

        input.value = '';
        loadComments(activeCardId);
        const card = allCards.find(c => c.id === activeCardId);
        if (card) card.comment_count++;
        renderBoard();
    };

    window.handleCommentKey = function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitComment();
        }
    };

    function setupMentionAutocomplete() {
        const input = document.getElementById('commentInput');
        const dropdown = document.getElementById('mentionDropdown');

        input.addEventListener('input', () => {
            const val = input.value;
            const cursorPos = input.selectionStart;
            const textBeforeCursor = val.substring(0, cursorPos);
            const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

            if (mentionMatch) {
                const query = mentionMatch[1].toLowerCase();
                const matches = USERS.filter(u =>
                    (u.username || '').toLowerCase().includes(query) ||
                    (u.nome_completo || '').toLowerCase().includes(query)
                );

                if (matches.length > 0) {
                    dropdown.innerHTML = matches.map(u =>
                        `<div class="mention-item" onclick="insertMention('${u.username}')">${u.nome_completo || u.username} <span class="mention-username">@${u.username}</span></div>`
                    ).join('');
                    dropdown.style.display = 'block';
                    return;
                }
            }
            dropdown.style.display = 'none';
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.comment-composer')) {
                dropdown.style.display = 'none';
            }
        });
    }

    window.insertMention = function (username) {
        const input = document.getElementById('commentInput');
        const val = input.value;
        const cursorPos = input.selectionStart;
        const textBeforeCursor = val.substring(0, cursorPos);
        const textAfterCursor = val.substring(cursorPos);
        const newBefore = textBeforeCursor.replace(/@\w*$/, `@${username} `);
        input.value = newBefore + textAfterCursor;
        input.focus();
        input.selectionStart = input.selectionEnd = newBefore.length;
        document.getElementById('mentionDropdown').style.display = 'none';
    };

    function formatMentions(text) {
        return text.replace(/@(\w+)/g, '<span class="mention-tag">@$1</span>');
    }

    // ══════════════════════════════════════════════════════════
    // CSV IMPORT INTO CARD
    // ══════════════════════════════════════════════════════════

    window.importCsvToCard = async function () {
        if (!activeCardId) return;
        const csvText = document.getElementById('modalCsvInput').value.trim();
        const status = document.getElementById('csvStatus');
        if (!csvText) {
            status.textContent = '⚠️ Cole o CSV primeiro';
            return;
        }

        const lines = csvText.split('\n').filter(l => l.trim());
        const items = [];

        for (const line of lines) {
            const parts = line.split(';').map(p => p.trim());
            if (parts.length >= 3) {
                items.push({
                    descricao: parts[0],
                    quantidade: parts[1],
                    valor_compra: parts[2],
                });
            }
        }

        if (items.length === 0) {
            status.textContent = '⚠️ Nenhum item válido encontrado';
            return;
        }

        status.textContent = `✅ ${items.length} itens prontos. Abra "Editar Orçamento" para adicionar.`;
        const existingDesc = document.getElementById('modalDescription').value || '';
        const csvNote = `\n\n---\n**Itens importados via CSV (${new Date().toLocaleString('pt-BR')}):**\n${items.map((it, i) => `${i + 1}. ${it.descricao} | Qtd: ${it.quantidade} | R$ ${it.valor_compra}`).join('\n')}`;
        document.getElementById('modalDescription').value = existingDesc + csvNote;
        document.getElementById('btnSaveDesc').style.display = 'inline-flex';
        document.getElementById('modalCsvInput').value = '';
    };

    // ══════════════════════════════════════════════════════════
    // FILTERS
    // ══════════════════════════════════════════════════════════

    function setupFilters() {
        document.getElementById('filterSearch')?.addEventListener('input', debounce(renderBoard, 200));
        document.getElementById('filterAssignee')?.addEventListener('change', renderBoard);
        document.getElementById('filterLabel')?.addEventListener('change', renderBoard);
    }

    // ══════════════════════════════════════════════════════════
    // UTILITIES
    // ══════════════════════════════════════════════════════════

    function getUrgencyClass(deadline) {
        if (!deadline) return '';
        const now = new Date();
        const dl = new Date(deadline);
        const hours = (dl - now) / (1000 * 60 * 60);

        if (hours < 0) return 'urgency-overdue';
        if (hours < 6) return 'urgency-critical';
        if (hours < 24) return 'urgency-warning';
        if (hours < 72) return 'urgency-notice';
        return '';
    }

    function formatDeadline(deadline) {
        const dl = new Date(deadline);
        const now = new Date();
        const diff = dl - now;

        if (diff < 0) return 'Atrasado';
        if (diff < 1000 * 60 * 60) return `${Math.round(diff / (1000 * 60))}min`;
        if (diff < 1000 * 60 * 60 * 24) return `${Math.round(diff / (1000 * 60 * 60))}h`;
        return dl.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }

    function debounce(fn, ms) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }
})();
