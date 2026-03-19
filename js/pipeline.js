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
                .sort((a, b) => {
                    const aTime = a.deadline ? new Date(a.deadline).getTime() : Infinity;
                    const bTime = b.deadline ? new Date(b.deadline).getTime() : Infinity;
                    return aTime - bTime;
                });

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
        else if (card.outcome === 'help') outcomeHtml = '<span class="outcome-indicator">🤝</span>';

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
            if (r.outcome === 'help') outcomeBadge = '<span class="outcome-badge outcome-badge-help">🤝 Para Ajudar</span>';

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
        // Default to preview mode
        setDescTab('preview');
        document.getElementById('modalAssignee').value = card.assigned_to || '';
        document.getElementById('modalDeadline').value = card.deadline ? new Date(card.deadline).toISOString().slice(0, 16) : '';

        // Outcome — dropdown
        const outcomeSection = document.getElementById('outcomeSection');
        if (card.stage === 'enviados') {
            outcomeSection.style.display = 'block';
            document.getElementById('modalOutcome').value = card.outcome || '';
        } else {
            outcomeSection.style.display = 'none';
        }

        // Delivery method
        initDeliveryUI(card.delivery_type || '', card.delivery_target || '', 'deliveryToggle', 'modalDeliveryTarget');

        // Links
        activeCardLinks = Array.isArray(card.links) ? [...card.links] : (typeof card.links === 'string' ? JSON.parse(card.links || '[]') : []);
        renderLinks();

        // Send action button
        updateSendActionButton(card.delivery_type, card.delivery_target);

        document.getElementById('btnEditQuote').href = `/orcamentos/form?id=${cardId}`;
        renderModalLabels(card);
        loadComments(cardId);
    };


    // ── Card Tabs ──
    window.switchCardTab = function (tab) {
        document.querySelectorAll('.card-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.card-tab-content').forEach(c => {
            c.style.display = 'none';
            c.classList.remove('active');
        });
        const tabMap = { desc: 'tabDesc', stats: 'tabStats', comments: 'tabComments', activity: 'tabActivity' };
        const tabEl = document.getElementById(tabMap[tab]);
        if (tabEl) { tabEl.style.display = 'block'; tabEl.classList.add('active'); }
        if (tab === 'stats' && activeCardId) loadCardStats(activeCardId);
        if (tab === 'activity' && activeCardId) loadActivities(activeCardId);
    };

    async function loadCardStats(cardId) {
        try {
            const res = await fetch(`/api/pipeline/cards/${cardId}/stats`);
            const data = await res.json();
            const fmt = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';
            document.getElementById('statItemCount').textContent = data.item_count || '0';
            document.getElementById('statTotalCompra').textContent = fmt(data.total_compra);
            document.getElementById('statTotalVenda').textContent = fmt(data.total_venda);
            document.getElementById('statLucro').textContent = fmt(data.lucro);
            document.getElementById('statLucroPercent').textContent = data.lucro_percent != null ? `${data.lucro_percent.toFixed(1)}%` : '—';
            document.getElementById('statComissao').textContent = fmt(data.comissao);
            document.getElementById('statsNote').style.display = (data.item_count > 0) ? 'none' : 'block';
            document.getElementById('cardStatsGrid').style.display = (data.item_count > 0) ? 'grid' : 'none';
        } catch (e) {
            console.error('Failed to load stats:', e);
        }
    }

    // ── Quote Editor Overlay ──
    window.openQuoteEditor = function () {
        if (!activeCardId) return;
        const overlay = document.getElementById('quoteEditorOverlay');
        const iframe = document.getElementById('quoteEditorIframe');
        iframe.src = `/orcamentos/form?id=${activeCardId}&embed=1`;
        overlay.style.display = 'flex';
    };

    window.closeQuoteEditor = function () {
        const overlay = document.getElementById('quoteEditorOverlay');
        const iframe = document.getElementById('quoteEditorIframe');
        overlay.style.display = 'none';
        iframe.src = '';
        if (activeCardId) loadCardStats(activeCardId);
    };

    window.closeCardModal = function () {
        document.getElementById('cardModal').style.display = 'none';
        activeCardId = null;
        activeCardStage = null;
        switchCardTab('desc');
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

    window.setDescTab = function (mode) {
        const writePane = document.getElementById('descWritePane');
        const previewPane = document.getElementById('descPreviewPane');
        const editBtn = document.getElementById('btnEditDesc');

        if (mode === 'write') {
            writePane.style.display = 'block';
            previewPane.style.display = 'none';
            editBtn.style.display = 'none';
            document.getElementById('modalDescription').focus();
        } else {
            const md = document.getElementById('modalDescription').value;
            document.getElementById('descPreviewContent').innerHTML = renderMarkdown(md);
            writePane.style.display = 'none';
            previewPane.style.display = 'block';
            editBtn.style.display = 'inline-flex';
        }
    };

    function renderMarkdown(text) {
        if (!text) return '<p style="color:#94a3b8;font-style:italic;">Sem descrição. Clique no lápis para editar.</p>';
        if (typeof marked !== 'undefined') {
            marked.setOptions({ breaks: true, gfm: true });
            return marked.parse(text);
        }
        // Fallback: simple line break rendering
        return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
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
        loadEnviadosStats();
        loadEnviados();
    };

    // ── Delivery Method ──
    let activeDeliveryType = '';

    function initDeliveryUI(type, target, toggleId, inputId) {
        activeDeliveryType = type || '';
        const toggle = document.getElementById(toggleId);
        toggle.querySelectorAll('.delivery-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        const input = document.getElementById(inputId);
        if (type) {
            input.style.display = 'block';
            input.value = target || '';
            input.placeholder = type === 'email' ? 'email@exemplo.com' : 'https://sistema.gov.br/...';
        } else {
            input.style.display = 'none';
            input.value = '';
        }
    }

    window.setDeliveryType = async function (type) {
        if (!activeCardId) return;
        activeDeliveryType = type;
        const toggle = document.getElementById('deliveryToggle');
        toggle.querySelectorAll('.delivery-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        const input = document.getElementById('modalDeliveryTarget');
        input.style.display = 'block';
        input.placeholder = type === 'email' ? 'email@exemplo.com' : 'https://sistema.gov.br/...';
        input.focus();
        await fetch(`/api/pipeline/cards/${activeCardId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delivery_type: type }),
        });
        const card = allCards.find(c => c.id === activeCardId);
        if (card) card.delivery_type = type;
        updateSendActionButton(type, input.value);
    };

    window.saveDeliveryTarget = async function () {
        if (!activeCardId) return;
        const target = document.getElementById('modalDeliveryTarget').value.trim();
        await fetch(`/api/pipeline/cards/${activeCardId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delivery_target: target }),
        });
        const card = allCards.find(c => c.id === activeCardId);
        if (card) card.delivery_target = target;
        updateSendActionButton(activeDeliveryType, target);
    };

    function updateSendActionButton(type, target) {
        const btn = document.getElementById('btnSendAction');
        const icon = document.getElementById('sendActionIcon');
        const text = document.getElementById('sendActionText');
        if (type && target) {
            btn.style.display = 'flex';
            if (type === 'email') {
                icon.className = 'fas fa-envelope';
                text.textContent = 'Enviar Email';
            } else {
                icon.className = 'fas fa-external-link-alt';
                text.textContent = 'Acessar Sistema';
            }
        } else {
            btn.style.display = 'none';
        }
    }

    window.handleSendAction = async function () {
        const target = document.getElementById('modalDeliveryTarget').value.trim();
        if (!target) return;

        // For link type, just open the URL
        if (activeDeliveryType !== 'email') {
            globalThis.open(target, '_blank');
            return;
        }

        // Email type — validate then generate PDFs and queue emails
        if (!activeCardId) return;

        try {
            // Validate items completeness first
            const validateRes = await fetch(`/api/pipeline/cards/${activeCardId}/validate-items`);
            const validation = await validateRes.json();
            if (!validation.valid) {
                alert('⚠️ ' + validation.message);
                return;
            }

            // Validate stats
            const statsRes = await fetch(`/api/pipeline/cards/${activeCardId}/stats`);
            const stats = await statsRes.json();
            if (!stats.item_count || stats.item_count === 0) {
                alert('⚠️ O orçamento não possui itens. Edite o orçamento e adicione itens antes de enviar.');
                return;
            }
            if (stats.total_venda === null || stats.total_venda === 0) {
                alert('⚠️ O orçamento não possui valores de venda preenchidos. Complete todos os campos antes de enviar.');
                return;
            }

            // Validate empresas
            const cardRes = await fetch(`/api/pipeline/cards/${activeCardId}/detail`);
            if (cardRes.ok) {
                const card = await cardRes.json();
                if (!card.empresa1_id || !card.empresa2_id || !card.empresa3_id) {
                    alert('⚠️ Selecione as 3 empresas no orçamento antes de enviar.');
                    return;
                }
            }
        } catch (e) {
            console.error('Validation error:', e);
        }

        // Show overlay and generate 3 PDFs
        const sendBtn = document.getElementById('btnSendAction');
        const originalText = document.getElementById('sendActionText').textContent;
        document.getElementById('sendActionText').textContent = 'Gerando PDFs...';
        sendBtn.style.pointerEvents = 'none';
        sendBtn.style.opacity = '0.6';

        const overlay = document.createElement('div');
        overlay.id = 'pdf-generation-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;';
        overlay.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 20px;">Gerando PDF <span id="overlay-counter">1</span>/3...</div>
            <div id="pdf-container-visible" style="background:white; width:790px; height:auto; padding:0; color:black; overflow:hidden; transform: scale(0.8); transform-origin: top center;"></div>
        `;
        document.body.appendChild(overlay);

        try {
            const container = document.getElementById('pdf-container-visible');
            const counter = document.getElementById('overlay-counter');
            const formData = new FormData();
            formData.append('recipient_email', target);

            for (let i = 1; i <= 3; i++) {
                counter.innerText = i;
                const url = `/print?id=${activeCardId}&company_index=${i}`;
                const response = await fetch(url);
                const htmlText = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                let css = '';
                doc.querySelectorAll('style').forEach(style => { css += style.innerHTML; });
                const bodyContent = doc.body.innerHTML;
                container.innerHTML = `<style>${css}</style><div class="pdf-content" style="padding:20px;">${bodyContent}</div>`;

                await new Promise(r => setTimeout(r, 800));

                const opt = {
                    margin: 0,
                    filename: `orcamento_${activeCardId}_${i}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
                formData.append(`pdf${i}`, pdfBlob, `orcamento_${i}.pdf`);
                await new Promise(r => setTimeout(r, 200));
            }

            document.body.removeChild(overlay);
            document.getElementById('sendActionText').textContent = 'Enviando para fila...';

            // Send to backend queue
            const res = await fetch(`/api/pipeline/cards/${activeCardId}/send-emails`, {
                method: 'POST',
                body: formData,
            });

            const json = await res.json();

            if (json.success) {
                document.getElementById('sendActionText').textContent = '✅ Fila criada!';
                sendBtn.style.opacity = '1';
                setTimeout(() => {
                    document.getElementById('sendActionText').textContent = originalText;
                    sendBtn.style.pointerEvents = 'auto';
                }, 3000);
                // Auto-switch to Activity tab
                switchCardTab('activity');
            } else {
                alert('❌ ' + json.message);
                document.getElementById('sendActionText').textContent = originalText;
                sendBtn.style.pointerEvents = 'auto';
                sendBtn.style.opacity = '1';
            }

        } catch (err) {
            console.error('Send emails error:', err);
            alert('Erro ao enviar: ' + err.message);
            const overlayEl = document.getElementById('pdf-generation-overlay');
            if (overlayEl) document.body.removeChild(overlayEl);
            document.getElementById('sendActionText').textContent = originalText;
            sendBtn.style.pointerEvents = 'auto';
            sendBtn.style.opacity = '1';
        }
    };

    // ── Links Manager ──
    let activeCardLinks = [];

    function renderLinks() {
        const container = document.getElementById('modalLinksList');
        if (!activeCardLinks.length) {
            container.innerHTML = '<span style="color:#94a3b8;font-size:0.8rem;font-style:italic;">Nenhum link adicionado</span>';
            return;
        }
        container.innerHTML = activeCardLinks.map((lk, i) =>
            `<div class="link-item">
                <a href="${escapeHtml(lk.url)}" target="_blank" rel="noopener" class="link-anchor">
                    <i class="fas fa-external-link-alt"></i> ${escapeHtml(lk.label || lk.url)}
                </a>
                <button class="btn-icon btn-remove-link" onclick="removeLink(${i})" title="Remover"><i class="fas fa-times"></i></button>
            </div>`
        ).join('');
    }

    window.addLink = async function () {
        if (!activeCardId) return;
        const label = document.getElementById('linkLabelInput').value.trim();
        const url = document.getElementById('linkUrlInput').value.trim();
        if (!url) return;
        activeCardLinks.push({ label: label || url, url });
        document.getElementById('linkLabelInput').value = '';
        document.getElementById('linkUrlInput').value = '';
        renderLinks();
        await fetch(`/api/pipeline/cards/${activeCardId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ links: activeCardLinks }),
        });
    };

    window.removeLink = async function (index) {
        if (!activeCardId) return;
        activeCardLinks.splice(index, 1);
        renderLinks();
        await fetch(`/api/pipeline/cards/${activeCardId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ links: activeCardLinks }),
        });
    };

    window.generateQuotesFromModal = function () {
        if (!activeCardId) return;
        window.open(`/print?id=${activeCardId}&company_index=1`, '_blank');
        setTimeout(() => window.open(`/print?id=${activeCardId}&company_index=2`, '_blank'), 200);
        setTimeout(() => window.open(`/print?id=${activeCardId}&company_index=3`, '_blank'), 400);
        // Log PDF generation activity
        fetch(`/api/pipeline/cards/${activeCardId}/log-activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'pdf_generated', metadata: {} }),
        }).catch(e => console.error('Failed to log PDF activity:', e));
    };

    // ══════════════════════════════════════════════════════════
    // NEW CARD MODAL
    // ══════════════════════════════════════════════════════════

    let newCardImportedItems = [];

    window.openNewCardModal = function () {
        newCardSelectedLabels = [];
        newCardDeliveryType = '';
        newCardImportedItems = [];
        document.getElementById('newCardModal').style.display = 'flex';
        document.getElementById('newCardTitle').value = '';
        document.getElementById('newCardSolicitante').value = '';
        document.getElementById('newCardCnpj').value = '';
        document.getElementById('newCardDescription').value = '';
        document.getElementById('newCardAssignee').value = '';
        document.getElementById('newCardDeadline').value = '';
        document.getElementById('newCardLabelInput').value = '';
        document.getElementById('newCardDeliveryTarget').value = '';
        document.getElementById('newCardDeliveryTarget').style.display = 'none';
        document.getElementById('newCardDeliveryToggle').querySelectorAll('.delivery-opt').forEach(b => b.classList.remove('active'));
        document.getElementById('newCardImportLabel').textContent = 'Importar Itens (CSV)';
        document.getElementById('newCardImportBtn').classList.remove('btn-import-done');
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

    let newCardDeliveryType = '';

    window.setNewCardDeliveryType = function (type) {
        newCardDeliveryType = type;
        const toggle = document.getElementById('newCardDeliveryToggle');
        toggle.querySelectorAll('.delivery-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        const input = document.getElementById('newCardDeliveryTarget');
        input.style.display = 'block';
        input.placeholder = type === 'email' ? 'email@exemplo.com' : 'https://sistema.gov.br/...';
        input.focus();
    };

    window.submitNewCard = async function () {
        const titulo = document.getElementById('newCardTitle').value.trim();
        if (!titulo) { document.getElementById('newCardTitle').focus(); return; }

        const payload = {
            titulo,
            solicitante_nome: document.getElementById('newCardSolicitante').value.trim(),
            solicitante_cnpj: document.getElementById('newCardCnpj').value.trim(),
            description: document.getElementById('newCardDescription').value.trim(),
            assigned_to: document.getElementById('newCardAssignee').value || null,
            deadline: document.getElementById('newCardDeadline').value || null,
            label_ids: newCardSelectedLabels.map(l => l.id),
            delivery_type: newCardDeliveryType || null,
            delivery_target: document.getElementById('newCardDeliveryTarget').value.trim() || null,
            imported_items: newCardImportedItems.length > 0 ? newCardImportedItems : undefined,
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
            } else {
                console.error('Create card error:', data);
            }
        } catch (e) {
            console.error('Failed to create card:', e);
        }
    };

    // ══════════════════════════════════════════════════════════
    // CSV IMPORT — works for both existing card and new card
    // ══════════════════════════════════════════════════════════
    let csvImportContext = 'card'; // 'card' or 'newCard'

    window.openCsvImportOverlay = function () {
        csvImportContext = 'card';
        document.getElementById('csvOverlay').style.display = 'flex';
        document.getElementById('csvOverlayInput').value = '';
        document.getElementById('csvOverlayStatus').textContent = '';
    };

    window.openNewCardCsvImport = function () {
        csvImportContext = 'newCard';
        document.getElementById('csvOverlay').style.display = 'flex';
        document.getElementById('csvOverlayInput').value = '';
        document.getElementById('csvOverlayStatus').textContent = '';
    };

    window.closeCsvOverlay = function () {
        document.getElementById('csvOverlay').style.display = 'none';
    };

    window.importCsvFromOverlay = async function () {
        const csvText = document.getElementById('csvOverlayInput').value.trim();
        const status = document.getElementById('csvOverlayStatus');
        if (!csvText) { status.textContent = '⚠️ Cole o CSV primeiro'; return; }

        const lines = csvText.split('\n').filter(l => l.trim());
        const items = [];
        for (const line of lines) {
            const parts = line.split(';').map(p => p.trim());
            if (parts.length >= 4) items.push({ codigo: parts[0], descricao: parts[1], quantidade: parts[2], valor_venda: parts[3] });
            else if (parts.length >= 3) items.push({ codigo: '', descricao: parts[0], quantidade: parts[1], valor_venda: parts[2] });
        }
        if (items.length === 0) { status.textContent = '⚠️ Nenhum item válido'; return; }

        if (csvImportContext === 'newCard') {
            // Store items for submit, update button label
            newCardImportedItems = items;
            const btn = document.getElementById('newCardImportBtn');
            const label = document.getElementById('newCardImportLabel');
            label.textContent = `${items.length} itens importados`;
            btn.classList.add('btn-import-done');
            status.textContent = `✅ ${items.length} itens prontos.`;
            setTimeout(() => closeCsvOverlay(), 1000);
            return;
        }

        // Existing card — append to description
        if (!activeCardId) return;
        const existingDesc = document.getElementById('modalDescription').value || '';
        const csvNote = `\n\n---\n**Itens importados via CSV (${new Date().toLocaleString('pt-BR')}):**\n${items.map((it, i) => `${i + 1}. ${it.codigo ? `[${it.codigo}] ` : ''}${it.descricao} | Qtd: ${it.quantidade} | R$ ${it.valor_venda}`).join('\n')}`;
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
    // ACTIVITIES TIMELINE
    // ══════════════════════════════════════════════════════════

    let activityRefreshTimer = null;

    async function loadActivities(cardId) {
        const container = document.getElementById('activityTimeline');
        container.innerHTML = '<div class="activity-loading"><i class="fas fa-spinner fa-spin"></i> Carregando atividades...</div>';

        try {
            const res = await fetch(`/api/pipeline/cards/${cardId}/activities`);
            const data = await res.json();
            renderActivities(data.activities || [], container);

            // Auto-refresh if there are pending emails
            if (activityRefreshTimer) clearInterval(activityRefreshTimer);
            const hasPending = (data.activities || []).some(a =>
                a.type === 'email_requested' && a.children?.some(c => c.type === 'email_pending')
            );
            if (hasPending) {
                activityRefreshTimer = setInterval(() => {
                    const activeTab = document.querySelector('.card-tab.active');
                    if (activeTab?.dataset.tab === 'activity' && activeCardId === cardId) {
                        loadActivities(cardId);
                    } else {
                        clearInterval(activityRefreshTimer);
                        activityRefreshTimer = null;
                    }
                }, 10000);
            }
        } catch (e) {
            container.innerHTML = '<div class="activity-empty">Erro ao carregar atividades.</div>';
            console.error('Load activities error:', e);
        }
    }

    function renderActivities(activities, container) {
        if (activities.length === 0) {
            container.innerHTML = '<div class="activity-empty"><i class="fas fa-history" style="font-size:2rem;color:#334155;margin-bottom:8px;"></i><p>Nenhuma atividade registrada.</p></div>';
            return;
        }

        container.innerHTML = activities.map(a => {
            const meta = getActivityMeta(a.type);
            const user = a.nome_completo || a.username || 'Sistema';
            const date = a.created_at ? formatActivityDate(a.created_at) : '';

            let childrenHtml = '';
            if (a.children && a.children.length > 0) {
                childrenHtml = '<div class="activity-children">' + a.children.map(c => {
                    const cMeta = getActivityMeta(c.type);
                    const cDate = c.created_at ? formatActivityDate(c.created_at) : '';
                    const cDetail = getSubActivityDetail(c);
                    return `<div class="activity-child">
                        <span class="activity-child-icon" style="color:${cMeta.color}">${cMeta.icon}</span>
                        <div class="activity-child-content">
                            <span class="activity-child-text">${cDetail}</span>
                            <span class="activity-child-date">${cDate}</span>
                        </div>
                    </div>`;
                }).join('') + '</div>';
            }

            const detail = getActivityDetail(a);

            return `<div class="activity-item">
                <div class="activity-icon" style="background:${meta.bgColor};color:${meta.color}">
                    <i class="${meta.iconClass}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-header">
                        <span class="activity-user">${escapeHtml(user)}</span>
                        <span class="activity-date">${date}</span>
                    </div>
                    <div class="activity-text">${detail}</div>
                    ${childrenHtml}
                </div>
            </div>`;
        }).join('');
    }

    function getActivityMeta(type) {
        const map = {
            created: { icon: '🆕', iconClass: 'fas fa-plus-circle', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)' },
            edited: { icon: '✏️', iconClass: 'fas fa-pencil-alt', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)' },
            pdf_generated: { icon: '🖨️', iconClass: 'fas fa-print', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.15)' },
            email_requested: { icon: '📧', iconClass: 'fas fa-paper-plane', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)' },
            email_pending: { icon: '⏳', iconClass: 'fas fa-clock', color: '#94a3b8', bgColor: 'rgba(148,163,184,0.15)' },
            email_sent: { icon: '✅', iconClass: 'fas fa-check-circle', color: '#22c55e', bgColor: 'rgba(34,197,94,0.15)' },
            email_failed: { icon: '❌', iconClass: 'fas fa-times-circle', color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
        };
        return map[type] || { icon: '📋', iconClass: 'fas fa-info-circle', color: '#64748b', bgColor: 'rgba(100,116,139,0.15)' };
    }

    function getActivityDetail(a) {
        const meta = a.metadata || {};
        switch (a.type) {
            case 'created': return 'Criou este cartão';
            case 'edited': return `Editou o orçamento${meta.field ? ` (${meta.field})` : ''}`;
            case 'pdf_generated': return 'Gerou os 3 PDFs de orçamento';
            case 'email_requested': return `Solicitou o disparo de 3 emails${meta.recipient ? ` para <strong>${escapeHtml(meta.recipient)}</strong>` : ''}`;
            default: return a.type;
        }
    }

    function getSubActivityDetail(c) {
        const meta = c.metadata || {};
        const idx = meta.company_index || '?';
        const ordinal = idx === 1 ? '1º' : idx === 2 ? '2º' : '3º';

        switch (c.type) {
            case 'email_pending': {
                const scheduled = meta.scheduled_at ? new Date(meta.scheduled_at) : null;
                const now = new Date();
                if (scheduled && scheduled > now) {
                    const diff = Math.ceil((scheduled - now) / 60000);
                    return `${ordinal} orçamento: <span class="status-pending">⏳ Aguardando envio</span> — agendado para daqui ${diff} min`;
                }
                return `${ordinal} orçamento: <span class="status-pending">⏳ Processando envio...</span>`;
            }
            case 'email_sent': {
                const sentAt = meta.sent_at ? formatActivityDate(meta.sent_at) : '';
                const company = meta.company_name ? ` via ${escapeHtml(meta.company_name)}` : '';
                return `${ordinal} orçamento: <span class="status-sent">✅ Enviado</span>${company} em ${sentAt}`;
            }
            case 'email_failed': {
                const err = meta.error ? ` — ${escapeHtml(meta.error)}` : '';
                return `${ordinal} orçamento: <span class="status-failed">❌ Falhou</span>${err}`;
            }
            default: return `${ordinal} orçamento: ${c.type}`;
        }
    }

    function formatActivityDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
        const diff = new Date(deadline) - Date.now();
        const absDiff = Math.abs(diff);
        const hours = Math.round(absDiff / 3600000);
        const days = Math.round(absDiff / 86400000);

        if (diff < 0) {
            if (hours < 1) return 'Agora';
            if (hours < 24) return `Atrasado ${hours}h`;
            return `Atrasado ${days}d`;
        }
        if (hours < 1) return `${Math.round(absDiff / 60000)}min`;
        if (hours < 24) return `Daqui ${hours}h`;
        if (days <= 30) return `Daqui ${days}d`;
        return `Daqui ${days}d`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }

    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
})();
