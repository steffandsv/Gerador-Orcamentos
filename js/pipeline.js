// ══════════════════════════════════════════════════════════════
// Pipeline Board — Client-Side Engine
// Drag & Drop · SSE Real-time · Card Modal · Labels · Comments
// ══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const STAGES = ['inbox', 'separada', 'cotacao', 'revisao', 'enviados'];
    const USERS = window.__PIPELINE_USERS__ || [];
    const CURRENT_USER = window.__CURRENT_USER__ || {};

    let allCards = [];
    let allLabels = [];
    let activeCardId = null;
    let draggedCardId = null;

    // ── Init ──
    document.addEventListener('DOMContentLoaded', () => {
        loadCards();
        loadLabels();
        connectSSE();
        setupFilters();
        setupLabelAddSelect();
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

    // ══════════════════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════════════════

    function renderBoard() {
        const searchTerm = document.getElementById('filterSearch')?.value?.toLowerCase() || '';
        const filterAssignee = document.getElementById('filterAssignee')?.value || '';
        const filterLabel = document.getElementById('filterLabel')?.value || '';

        STAGES.forEach(stage => {
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

            // Update count
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
        const cardId = parseInt(e.dataTransfer.getData('text/plain'));
        if (!cardId) return;

        const card = allCards.find(c => c.id === cardId);
        if (!card || card.stage === targetStage) return;

        // Optimistic update
        const oldStage = card.stage;
        card.stage = targetStage;

        // Calculate new position (at end of target stage)
        const targetCards = allCards.filter(c => c.stage === targetStage && c.id !== cardId);
        card.position = targetCards.length;

        renderBoard();

        try {
            await fetch(`/api/pipeline/cards/${cardId}/move`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage: targetStage, position: card.position }),
            });

            // Reorder all cards in new stage
            const orderedIds = allCards
                .filter(c => c.stage === targetStage)
                .sort((a, b) => a.position - b.position)
                .map(c => c.id);

            await fetch('/api/pipeline/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardIds: orderedIds, stage: targetStage }),
            });
        } catch (err) {
            // Rollback
            card.stage = oldStage;
            renderBoard();
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
            const card = allCards.find(c => c.id === data.cardId);
            if (card) {
                card.stage = data.stage;
                card.position = data.position;
                renderBoard();
            }
        });

        es.addEventListener('card_updated', (e) => {
            const data = JSON.parse(e.data);
            loadCards(); // Full reload for simplicity on updates
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
        });

        es.addEventListener('card_label_added', () => loadCards());
        es.addEventListener('card_label_removed', () => loadCards());
        es.addEventListener('label_created', () => loadLabels());
        es.addEventListener('label_updated', () => loadLabels());
        es.addEventListener('label_deleted', () => { loadLabels(); loadCards(); });
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
        const card = allCards.find(c => c.id === cardId);
        if (!card) return;

        document.getElementById('cardModal').style.display = 'flex';
        document.getElementById('modalTitle').textContent = card.titulo;
        document.getElementById('modalDescription').value = card.description || '';
        document.getElementById('btnSaveDesc').style.display = 'none';
        document.getElementById('modalAssignee').value = card.assigned_to || '';
        document.getElementById('modalDeadline').value = card.deadline
            ? new Date(card.deadline).toISOString().slice(0, 16)
            : '';

        // Outcome section
        const outcomeSection = document.getElementById('outcomeSection');
        if (card.stage === 'enviados') {
            outcomeSection.style.display = 'block';
            document.querySelectorAll('.outcome-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.outcome === (card.outcome || ''));
            });
        } else {
            outcomeSection.style.display = 'none';
        }

        // Edit/Print links
        document.getElementById('btnEditQuote').href = `/orcamentos/form?id=${cardId}`;

        // Labels in sidebar
        renderModalLabels(card);

        // Load comments
        loadComments(cardId);
    };

    window.closeCardModal = function () {
        document.getElementById('cardModal').style.display = 'none';
        activeCardId = null;
    };

    // Click outside to close
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

    // ── Assign User ──
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
    };

    // ── Save Deadline ──
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

    // ── Set Outcome ──
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
        if (card) {
            card.outcome = outcome || null;
            renderBoard();
        }
    };

    // ── Generate PDFs (from modal) ──
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

        // Update add select (exclude already-assigned)
        const select = document.getElementById('labelAddSelect');
        const assignedIds = card.labels.map(l => l.id);
        select.innerHTML = '<option value="">+ Adicionar...</option>';
        allLabels.filter(l => !assignedIds.includes(l.id)).forEach(l => {
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

    // ── Label Manager ──
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

        // Update comment count locally
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

    // ── @Mention Autocomplete ──
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

        // Save items via the existing quote form save endpoint
        // We need to fetch current quote data first, then resave with merged items
        status.textContent = `✅ ${items.length} itens prontos. Abra "Editar Orçamento" para adicionar.`;
        // Store in description as a note
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

    function setupLabelAddSelect() {
        // Handled dynamically in renderModalLabels
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
