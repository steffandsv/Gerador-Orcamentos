// ══════════════════════════════════════════════════════════════
// Pipeline Board — Client-Side Engine (Hybrid View v3)
// 3 Active Columns + Enviados Summary & Table
// New Card Modal · CSV Overlay · Inline Label Creation
// ══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const ACTIVE_STAGES = ['inbox', 'cotacao', 'revisao'];
    const USERS = window.__PIPELINE_USERS__ || [];
    const CURRENT_USER = window.__CURRENT_USER__ || {};

    let allCards = [];
    let allLabels = [];
    let activeCardId = null;
    let activeCardStage = null;
    let draggedCardId = null;
    let newCardSelectedLabels = [];
    let descSaveTimer = null;

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
            const el = (id) => document.getElementById(id);
            el('glanceTotalNum').textContent = data.total;
            el('glancePendingNum').textContent = data.pending;
            el('glanceWonNum').textContent = data.won;
            el('glanceLostNum').textContent = data.lost;
            el('count-enviados').textContent = data.total;
        } catch (e) {
            console.error('Failed to load enviados stats:', e);
        }
    }

    async function loadEnviados() {
        const s = enviadosState;
        const params = new URLSearchParams({ page: String(s.page), sortBy: s.sortBy, sortDir: s.sortDir });
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
    // BOARD RENDERING
    // ══════════════════════════════════════════════════════════

    function renderBoard() {
        const searchTerm = (document.getElementById('filterSearch')?.value || '').toLowerCase();
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

        let outcomeHtml = '';
        if (card.outcome === 'won') outcomeHtml = '<span class="outcome-indicator">🏆</span>';
        else if (card.outcome === 'lost') outcomeHtml = '<span class="outcome-indicator">❌</span>';

        const metaHtml = [];
        if (card.item_count > 0) metaHtml.push(`<span class="card-meta-item"><i class="fas fa-list"></i> ${card.item_count}</span>`);
        if (card.comment_count > 0) metaHtml.push(`<span class="card-meta-item"><i class="fas fa-comment"></i> ${card.comment_count}</span>`);

        return `
        <div class="pipeline-card ${urgencyClass}" data-id="${card.id}"
             draggable="true" ondragstart="handleDragStart(event, ${card.id})"
             ondragend="handleDragEnd(event)" onclick="openCardModal(${card.id})">
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
    // ENVIADOS TABLE
    // ══════════════════════════════════════════════════════════

    function renderEnviadosTable(rows, page, totalPages, totalCount) {
        const tbody = document.getElementById('enviadosBody');

        if (rows.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Nenhuma cotação enviada encontrada.</td></tr>';
            document.getElementById('enviadosPagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const assigneeName = r.assignee ? (r.assignee.nome_completo || r.assignee.username) : '—';
            const labelsHtml = r.labels.map(l =>
                `<span class="label-pill" style="background:${l.color}20; color:${l.color}; border-color:${l.color}40">${l.name}</span>`
            ).join(' ');

            const deadlineStr = r.deadline ? new Date(r.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
            const updatedStr = r.updated_at ? new Date(r.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

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

        renderPagination(page, totalPages, totalCount);
    }

    function renderPagination(page, totalPages, totalCount) {
        const c = document.getElementById('enviadosPagination');
        if (totalPages <= 1) { c.innerHTML = `<span class="pagination-info">${totalCount} registro${totalCount !== 1 ? 's' : ''}</span>`; return; }
        let h = `<span class="pagination-info">${totalCount} registros · Página ${page} de ${totalPages}</span><div class="pagination-buttons">`;
        if (page > 1) h += `<button class="pagination-btn" onclick="goToEnviadosPage(${page - 1})"><i class="fas fa-chevron-left"></i></button>`;
        const start = Math.max(1, page - 2), end = Math.min(totalPages, page + 2);
        for (let i = start; i <= end; i++) h += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="goToEnviadosPage(${i})">${i}</button>`;
        if (page < totalPages) h += `<button class="pagination-btn" onclick="goToEnviadosPage(${page + 1})"><i class="fas fa-chevron-right"></i></button>`;
        h += '</div>';
        c.innerHTML = h;
    }

    window.goToEnviadosPage = function (p) { enviadosState.page = p; loadEnviados(); };

    window.sortEnviados = function (field) {
        enviadosState.sortDir = (enviadosState.sortBy === field) ? (enviadosState.sortDir === 'desc' ? 'asc' : 'desc') : 'desc';
        enviadosState.sortBy = field;
        enviadosState.page = 1;
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
    window.handleDragOver = function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-over'); };
    window.handleDragLeave = function (e) { e.currentTarget.classList.remove('drag-over'); };

    window.handleDrop = async function (e, targetStage) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const cardId = Number.parseInt(e.dataTransfer.getData('text/plain'));
        if (!cardId) return;
        const card = allCards.find(c => c.id === cardId);
        if (!card || card.stage === targetStage) return;

        if (targetStage === 'enviados') {
            allCards = allCards.filter(c => c.id !== cardId);
            renderBoard();
        } else {
            card.stage = targetStage;
            card.position = allCards.filter(c => c.stage === targetStage && c.id !== cardId).length;
            renderBoard();
        }

        try {
            await fetch(`/api/pipeline/cards/${cardId}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: targetStage, position: 0 }),
            });
            if (targetStage === 'enviados') { loadEnviadosStats(); loadEnviados(); }
        } catch (err) {
            console.error('Move failed:', err);
            loadCards();
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
            loadCards(); loadEnviadosStats(); loadEnviados();
        });
        es.addEventListener('card_updated', () => { loadCards(); loadEnviadosStats(); loadEnviados(); });
        es.addEventListener('card_assigned', (e) => {
            const data = JSON.parse(e.data);
            const card = allCards.find(c => c.id === data.cardId);
            if (card) {
                card.assigned_to = data.user_id;
                card.assignee = data.user_id ? USERS.find(u => u.id === data.user_id) || null : null;
                renderBoard();
            }
            loadEnviados();
        });
        es.addEventListener('card_label_added', () => { loadCards(); loadEnviados(); });
        es.addEventListener('card_label_removed', () => { loadCards(); loadEnviados(); });
        es.addEventListener('label_created', () => loadLabels());
        es.addEventListener('label_updated', () => loadLabels());
        es.addEventListener('label_deleted', () => { loadLabels(); loadCards(); loadEnviados(); });
        es.addEventListener('comment_added', () => { if (activeCardId) loadComments(activeCardId); });
        es.onerror = () => { setTimeout(connectSSE, 3000); es.close(); };
    }

    // ══════════════════════════════════════════════════════════
    // CARD DETAIL MODAL
    // ══════════════════════════════════════════════════════════

    window.openCardModal = async function (cardId) {
        activeCardId = cardId;

        // Try active cards, then fetch from API (for enviados)
        let card = allCards.find(c => c.id === cardId);
        if (!card) {
            try {
                const res = await fetch('/api/pipeline/cards');
                const data = await res.json();
                card = (data.cards || []).find(c => c.id === cardId);
            } catch (e) { /* fallback below */ }
        }
        // Still not found — fetch single card via enviados endpoint
        if (!card) {
            try {
                const res = await fetch(`/api/pipeline/enviados?search=&page=1&sortBy=updated_at&sortDir=desc`);
                const data = await res.json();
                card = (data.rows || []).find(r => r.id === cardId);
                if (card) {
                    card.labels = card.labels || [];
                    card.stage = 'enviados';
                }
            } catch (e) {
                console.error('Failed to fetch card:', e);
                return;
            }
        }
        if (!card) return;

        activeCardStage = card.stage;
        document.getElementById('cardModal').style.display = 'flex';
        document.getElementById('modalTitle').textContent = card.titulo;
        document.getElementById('modalDescription').value = card.description || '';
        document.getElementById('descSaveStatus').textContent = '';
        // Reset to write tab
        setDescTab('write');
        document.getElementById('modalAssignee').value = card.assigned_to || '';
        document.getElementById('modalDeadline').value = card.deadline ? new Date(card.deadline).toISOString().slice(0, 16) : '';

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
        activeCardStage = null;
    };

    document.addEventListener('click', (e) => {
        if (e.target.id === 'cardModal') closeCardModal();
        if (e.target.id === 'labelManagerModal') closeLabelManager();
        if (e.target.id === 'newCardModal') closeNewCardModal();
        if (e.target.id === 'csvOverlay') closeCsvOverlay();
    });

    // ── Description auto-save + markdown preview ──

    window.onDescriptionInput = function () {
        const status = document.getElementById('descSaveStatus');
        status.textContent = '...';
        status.className = 'desc-save-status saving';
        if (descSaveTimer) clearTimeout(descSaveTimer);
        descSaveTimer = setTimeout(() => autoSaveDescription(), 800);
    };

    async function autoSaveDescription() {
        if (!activeCardId) return;
        const desc = document.getElementById('modalDescription').value;
        const status = document.getElementById('descSaveStatus');
        try {
            status.textContent = 'Salvando...';
            await fetch(`/api/pipeline/cards/${activeCardId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: desc }),
            });
            const card = allCards.find(c => c.id === activeCardId);
            if (card) card.description = desc;
            status.textContent = 'Salvo ✓';
            status.className = 'desc-save-status saved';
            setTimeout(() => { if (status.textContent === 'Salvo ✓') status.textContent = ''; }, 2000);
        } catch (e) {
            status.textContent = '❌ Erro';
            status.className = 'desc-save-status error';
            console.error('Auto-save failed:', e);
        }
    }

    window.setDescTab = function (tab) {
        const writePane = document.getElementById('descWritePane');
        const previewPane = document.getElementById('descPreviewPane');
        const tabWrite = document.getElementById('tabWrite');
        const tabPreview = document.getElementById('tabPreview');
        if (tab === 'write') {
            writePane.style.display = 'block';
            previewPane.style.display = 'none';
            tabWrite.classList.add('active');
            tabPreview.classList.remove('active');
        } else {
            const md = document.getElementById('modalDescription').value;
            document.getElementById('descPreviewContent').innerHTML = renderMarkdown(md);
            writePane.style.display = 'none';
            previewPane.style.display = 'block';
            tabWrite.classList.remove('active');
            tabPreview.classList.add('active');
        }
    };

    function renderMarkdown(text) {
        if (!text) return '<p style="color:#94a3b8;font-style:italic;">Sem descrição.</p>';
        let html = escapeHtml(text);
        // Headings
        html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
        // Bold + Italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Code blocks
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Horizontal rule
        html = html.replace(/^---$/gm, '<hr>');
        // Unordered list
        html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
        // Ordered list
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        // Line breaks → paragraphs
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        html = '<p>' + html + '</p>';
        // Clean empty paragraphs
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>(<h[2-4]>)/g, '$1');
        html = html.replace(/(<\/h[2-4]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre>)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');
        return html;
    }

    window.assignUser = async function () {
        if (!activeCardId) return;
        const userId = document.getElementById('modalAssignee').value;
        await fetch(`/api/pipeline/cards/${activeCardId}/assign`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deadline: val || null }),
        });
        const card = allCards.find(c => c.id === activeCardId);
        if (card) { card.deadline = val || null; renderBoard(); }
    };

    window.setOutcome = async function (outcome) {
        if (!activeCardId) return;
        await fetch(`/api/pipeline/cards/${activeCardId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome }),
        });
        document.querySelectorAll('.outcome-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.outcome === outcome);
        });
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
    // NEW CARD MODAL
    // ══════════════════════════════════════════════════════════

    window.openNewCardModal = function () {
        newCardSelectedLabels = [];
        document.getElementById('newCardModal').style.display = 'flex';
        document.getElementById('newCardTitle').value = '';
        document.getElementById('newCardSolicitante').value = '';
        document.getElementById('newCardDescription').value = '';
        document.getElementById('newCardAssignee').value = '';
        document.getElementById('newCardDeadline').value = '';
        document.getElementById('newCardLabelInput').value = '';
        renderNewCardLabels();
        setTimeout(() => document.getElementById('newCardTitle').focus(), 100);
    };

    window.closeNewCardModal = function () {
        document.getElementById('newCardModal').style.display = 'none';
    };

    function renderNewCardLabels() {
        const container = document.getElementById('newCardLabels');
        container.innerHTML = newCardSelectedLabels.map(l =>
            `<span class="label-pill label-pill-lg" style="background:${l.color}20; color:${l.color}; border-color:${l.color}40">
                ${l.name}
                <button class="label-remove" onclick="removeNewCardLabel(${l.id}); event.stopPropagation();">×</button>
            </span>`
        ).join('');
    }

    window.removeNewCardLabel = function (id) {
        newCardSelectedLabels = newCardSelectedLabels.filter(l => l.id !== id);
        renderNewCardLabels();
    };

    window.handleNewCardLabelKey = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = document.getElementById('newCardLabelInput');
            const text = input.value.trim();
            if (!text) return;

            // Check if existing label matches
            const existing = allLabels.find(l => l.name.toLowerCase() === text.toLowerCase());
            if (existing && !newCardSelectedLabels.some(l => l.id === existing.id)) {
                newCardSelectedLabels.push({ id: existing.id, name: existing.name, color: existing.color });
                input.value = '';
                renderNewCardLabels();
                hideSuggestions('newCardLabelSuggestions');
                return;
            }

            // Create new label
            createAndAddLabel(text, input, 'newCard');
        }
    };

    window.showNewCardLabelSuggestions = function () {
        showLabelSuggestionsFor('newCardLabelInput', 'newCardLabelSuggestions', 'newCard');
    };

    window.submitNewCard = async function () {
        const titulo = document.getElementById('newCardTitle').value.trim();
        if (!titulo) { document.getElementById('newCardTitle').focus(); return; }

        const payload = {
            titulo,
            solicitante_nome: document.getElementById('newCardSolicitante').value.trim(),
            description: document.getElementById('newCardDescription').value.trim(),
            assigned_to: document.getElementById('newCardAssignee').value || null,
            deadline: document.getElementById('newCardDeadline').value || null,
            label_ids: newCardSelectedLabels.map(l => l.id),
        };

        try {
            const res = await fetch('/api/pipeline/cards', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                closeNewCardModal();
                loadCards();
            }
        } catch (e) {
            console.error('Failed to create card:', e);
        }
    };

    // ══════════════════════════════════════════════════════════
    // CSV IMPORT OVERLAY
    // ══════════════════════════════════════════════════════════

    window.openCsvImportOverlay = function () {
        document.getElementById('csvOverlay').style.display = 'flex';
        document.getElementById('csvOverlayInput').value = '';
        document.getElementById('csvOverlayStatus').textContent = '';
    };

    window.closeCsvOverlay = function () {
        document.getElementById('csvOverlay').style.display = 'none';
    };

    window.importCsvFromOverlay = async function () {
        if (!activeCardId) return;
        const csvText = document.getElementById('csvOverlayInput').value.trim();
        const status = document.getElementById('csvOverlayStatus');
        if (!csvText) { status.textContent = '⚠️ Cole o CSV primeiro'; return; }

        const lines = csvText.split('\n').filter(l => l.trim());
        const items = [];
        for (const line of lines) {
            const parts = line.split(';').map(p => p.trim());
            if (parts.length >= 3) items.push({ descricao: parts[0], quantidade: parts[1], valor_compra: parts[2] });
        }
        if (items.length === 0) { status.textContent = '⚠️ Nenhum item válido'; return; }

        // Append to description and auto-save
        const existingDesc = document.getElementById('modalDescription').value || '';
        const csvNote = `\n\n---\n**Itens importados via CSV (${new Date().toLocaleString('pt-BR')}):**\n${items.map((it, i) => `${i + 1}. ${it.descricao} | Qtd: ${it.quantidade} | R$ ${it.valor_compra}`).join('\n')}`;
        document.getElementById('modalDescription').value = existingDesc + csvNote;
        autoSaveDescription();

        status.textContent = `✅ ${items.length} itens adicionados à descrição.`;
        setTimeout(() => closeCsvOverlay(), 1500);
    };

    // ══════════════════════════════════════════════════════════
    // LABELS — Inline type-to-add
    // ══════════════════════════════════════════════════════════

    function renderModalLabels(card) {
        const container = document.getElementById('modalLabels');
        container.innerHTML = card.labels.map(l =>
            `<span class="label-pill label-pill-lg" style="background:${l.color}20; color:${l.color}; border-color:${l.color}40">
                ${l.name}
                <button class="label-remove" onclick="removeCardLabel(${card.id}, ${l.id}); event.stopPropagation();">×</button>
            </span>`
        ).join('');
    }

    window.showLabelSuggestions = function () {
        showLabelSuggestionsFor('labelInlineInput', 'labelSuggestions', 'modal');
    };

    window.handleLabelInputKey = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = document.getElementById('labelInlineInput');
            const text = input.value.trim();
            if (!text || !activeCardId) return;

            // Check existing
            const existing = allLabels.find(l => l.name.toLowerCase() === text.toLowerCase());
            if (existing) {
                addCardLabel(activeCardId, existing.id);
                input.value = '';
                hideSuggestions('labelSuggestions');
                return;
            }
            // Create new
            createAndAddLabel(text, input, 'modal');
        }
    };

    function showLabelSuggestionsFor(inputId, dropdownId, context) {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        const query = (input.value || '').trim().toLowerCase();

        if (!query) { dropdown.style.display = 'none'; return; }

        // Get already-assigned IDs
        let assignedIds = [];
        if (context === 'modal' && activeCardId) {
            const card = allCards.find(c => c.id === activeCardId);
            assignedIds = (card?.labels || []).map(l => l.id);
        } else if (context === 'newCard') {
            assignedIds = newCardSelectedLabels.map(l => l.id);
        }

        const matches = allLabels.filter(l =>
            l.name.toLowerCase().includes(query) && !assignedIds.includes(l.id)
        );

        if (matches.length === 0 && query.length > 0) {
            dropdown.innerHTML = `<div class="label-suggestion-item label-suggestion-create" onclick="createAndAddLabelFromSuggestion('${escapeHtml(query)}', '${inputId}', '${context}')">
                <i class="fas fa-plus"></i> Criar "<strong>${escapeHtml(query)}</strong>"
            </div>`;
            dropdown.style.display = 'block';
            return;
        }

        if (matches.length === 0) { dropdown.style.display = 'none'; return; }

        let html = matches.map(l =>
            `<div class="label-suggestion-item" onclick="selectLabelSuggestion(${l.id}, '${inputId}', '${dropdownId}', '${context}')">
                <span class="label-pill" style="background:${l.color}20; color:${l.color}; border-color:${l.color}40">${l.name}</span>
            </div>`
        ).join('');

        // Always show "create new" option at the bottom
        const exactMatch = allLabels.some(l => l.name.toLowerCase() === query);
        if (!exactMatch) {
            html += `<div class="label-suggestion-item label-suggestion-create" onclick="createAndAddLabelFromSuggestion('${escapeHtml(query)}', '${inputId}', '${context}')">
                <i class="fas fa-plus"></i> Criar "<strong>${escapeHtml(query)}</strong>"
            </div>`;
        }

        dropdown.innerHTML = html;
        dropdown.style.display = 'block';
    }

    function hideSuggestions(dropdownId) {
        const dd = document.getElementById(dropdownId);
        if (dd) dd.style.display = 'none';
    }

    window.selectLabelSuggestion = function (labelId, inputId, dropdownId, context) {
        const input = document.getElementById(inputId);
        input.value = '';
        hideSuggestions(dropdownId);

        if (context === 'modal' && activeCardId) {
            addCardLabel(activeCardId, labelId);
        } else if (context === 'newCard') {
            const label = allLabels.find(l => l.id === labelId);
            if (label && !newCardSelectedLabels.some(l => l.id === labelId)) {
                newCardSelectedLabels.push({ id: label.id, name: label.name, color: label.color });
                renderNewCardLabels();
            }
        }
    };

    window.createAndAddLabelFromSuggestion = function (name, inputId, context) {
        const input = document.getElementById(inputId);
        createAndAddLabel(name, input, context);
    };

    async function createAndAddLabel(name, inputEl, context) {
        try {
            const res = await fetch('/api/pipeline/labels', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, color: '#3b82f6' }),
            });
            const data = await res.json();
            if (data.success && data.label) {
                allLabels.push(data.label);
                populateLabelFilters();
                inputEl.value = '';
                hideSuggestions('labelSuggestions');
                hideSuggestions('newCardLabelSuggestions');

                if (context === 'modal' && activeCardId) {
                    addCardLabel(activeCardId, data.label.id);
                } else if (context === 'newCard') {
                    newCardSelectedLabels.push({ id: data.label.id, name: data.label.name, color: data.label.color });
                    renderNewCardLabels();
                }
            }
        } catch (e) {
            console.error('Failed to create label:', e);
        }
    }

    async function addCardLabel(cardId, labelId) {
        await fetch(`/api/pipeline/cards/${cardId}/labels`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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

    // ── Label Manager ──
    window.openLabelManager = function () {
        document.getElementById('labelManagerModal').style.display = 'flex';
        renderLabelManagerList();
    };
    window.closeLabelManager = function () { document.getElementById('labelManagerModal').style.display = 'none'; };

    function renderLabelManagerList() {
        document.getElementById('labelManagerList').innerHTML = allLabels.map(l =>
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
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
            allLabels.forEach(l => { filterSelect.innerHTML += `<option value="${l.id}">${l.name}</option>`; });
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
            list.innerHTML = cmnts.length === 0
                ? '<div class="comment-empty">Nenhum comentário ainda.</div>'
                : cmnts.map(c => renderComment(c)).join('');
        } catch (e) {
            list.innerHTML = '<div class="comment-empty">Erro ao carregar comentários.</div>';
        }
    }

    function renderComment(c) {
        const initials = (c.nome_completo || c.username || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        const date = new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        return `<div class="comment-item"><div class="comment-avatar">${initials}</div>
            <div class="comment-content"><div class="comment-header"><strong>${escapeHtml(c.nome_completo || c.username)}</strong>
            <span class="comment-date">${date}</span></div>
            <div class="comment-body">${formatMentions(escapeHtml(c.body))}</div></div></div>`;
    }

    window.submitComment = async function () {
        if (!activeCardId) return;
        const input = document.getElementById('commentInput');
        const body = input.value.trim();
        if (!body) return;
        await fetch(`/api/pipeline/cards/${activeCardId}/comments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body }),
        });
        input.value = '';
        loadComments(activeCardId);
    };

    window.handleCommentKey = function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
    };

    function setupMentionAutocomplete() {
        const input = document.getElementById('commentInput');
        const dropdown = document.getElementById('mentionDropdown');
        input.addEventListener('input', () => {
            const textBefore = input.value.substring(0, input.selectionStart);
            const m = textBefore.match(/@(\w*)$/);
            if (m) {
                const q = m[1].toLowerCase();
                const matches = USERS.filter(u => (u.username || '').toLowerCase().includes(q) || (u.nome_completo || '').toLowerCase().includes(q));
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
            if (!e.target.closest('.comment-composer')) dropdown.style.display = 'none';
        });
    }

    window.insertMention = function (username) {
        const input = document.getElementById('commentInput');
        const before = input.value.substring(0, input.selectionStart).replace(/@\w*$/, `@${username} `);
        const after = input.value.substring(input.selectionStart);
        input.value = before + after;
        input.focus();
        input.selectionStart = input.selectionEnd = before.length;
        document.getElementById('mentionDropdown').style.display = 'none';
    };

    function formatMentions(text) { return text.replace(/@(\w+)/g, '<span class="mention-tag">@$1</span>'); }

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
        const hours = (new Date(deadline) - new Date()) / (1000 * 60 * 60);
        if (hours < 0) return 'urgency-overdue';
        if (hours < 6) return 'urgency-critical';
        if (hours < 24) return 'urgency-warning';
        if (hours < 72) return 'urgency-notice';
        return '';
    }

    function formatDeadline(deadline) {
        const diff = new Date(deadline) - new Date();
        if (diff < 0) return 'Atrasado';
        if (diff < 3600000) return `${Math.round(diff / 60000)}min`;
        if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
        return new Date(deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }

    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
})();
