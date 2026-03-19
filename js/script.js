document.addEventListener('DOMContentLoaded', function() {
    // Helper for SweetAlert or Fallback
    const showAlert = (message, title = 'Atenção', icon = 'info') => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ title, text: message, icon, confirmButtonColor: '#3b82f6' });
        } else {
            alert(message);
        }
    };

    // ========================================================================
    // PRICING ENGINE
    // ========================================================================

    function calcularPrecoVenda(precoCompra) {
        if (precoCompra == null || precoCompra <= 0) return null;

        const expoente = Math.pow(precoCompra / 150, 0.7);
        const margemDinamica = 0.2 + (0.5 / (1 + expoente));
        const precoBase = precoCompra / (1 - margemDinamica);

        let precoBaseFormatado = 0;
        if (precoBase < 100) {
            precoBaseFormatado = Math.floor(precoBase * 10) / 10 - 0.01;
        } else if (precoBase < 1000) {
            precoBaseFormatado = Math.floor(precoBase) - 0.01;
        } else if (precoBase < 10000) {
            precoBaseFormatado = Math.floor(precoBase / 10) * 10 - 1;
        } else {
            precoBaseFormatado = Math.floor(precoBase / 100) * 100 - 10;
        }

        const precoMinimo = precoCompra / 0.8;

        if (precoBaseFormatado >= precoMinimo) {
            return Number(precoBaseFormatado.toFixed(2));
        }

        let precoMinimoFormatado = 0;
        if (precoMinimo < 100) {
            precoMinimoFormatado = Math.ceil((precoMinimo + 0.01) * 10) / 10 - 0.01;
        } else if (precoMinimo < 1000) {
            precoMinimoFormatado = Math.ceil(precoMinimo + 0.01) - 0.01;
        } else if (precoMinimo < 10000) {
            precoMinimoFormatado = Math.ceil((precoMinimo + 1) / 10) * 10 - 1;
        } else {
            precoMinimoFormatado = Math.ceil((precoMinimo + 10) / 100) * 100 - 10;
        }

        return Number(precoMinimoFormatado.toFixed(2));
    }

    function calcularComissao(margemLucro) {
        if (margemLucro == null || isNaN(margemLucro)) return null;
        if (margemLucro < 0.20) return 0.05;
        if (margemLucro < 0.25) return 0.10;
        if (margemLucro < 0.30) return 0.15;
        if (margemLucro < 0.35) return 0.20;
        return 0.40;
    }

    function getComissaoTier(rate) {
        if (rate == null) return { label: '—', cls: 'tier-none' };
        if (rate <= 0.05) return { label: '5%', cls: 'tier-1' };
        if (rate <= 0.10) return { label: '10%', cls: 'tier-2' };
        if (rate <= 0.15) return { label: '15%', cls: 'tier-3' };
        if (rate <= 0.20) return { label: '20%', cls: 'tier-4' };
        return { label: '40%', cls: 'tier-5' };
    }

    function formatBRL(val) {
        if (val == null || isNaN(val)) return 'R$ 0,00';
        return 'R$ ' + val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function formatPct(val) {
        if (val == null || isNaN(val)) return '0,0%';
        return (val * 100).toFixed(1).replace('.', ',') + '%';
    }

    // ========================================================================
    // AUTO-SAVE HELPERS
    // ========================================================================

    let _currentOrcamentoId = null;
    const _quoteIdInput = document.querySelector('input[name="quote_id"]');
    if (_quoteIdInput) _currentOrcamentoId = _quoteIdInput.value;

    let _saveDebounceTimers = {};
    let _headerSaveTimer = null;

    function showRowSaveStatus(tr, status) {
        let badge = tr.querySelector('.row-save-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'row-save-badge';
            const actionsCell = tr.querySelector('.cell-actions');
            if (actionsCell) actionsCell.insertBefore(badge, actionsCell.firstChild);
        }
        if (status === 'saving') {
            badge.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="color:#94a3b8;font-size:0.7rem;"></i>';
            badge.style.opacity = '1';
        } else if (status === 'saved') {
            badge.innerHTML = '<i class="fas fa-check" style="color:#22c55e;font-size:0.7rem;"></i>';
            badge.style.opacity = '1';
            setTimeout(() => { badge.style.opacity = '0'; }, 2000);
        } else if (status === 'error') {
            badge.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#ef4444;font-size:0.7rem;"></i>';
            badge.style.opacity = '1';
        }
    }

    function showHeaderSaveStatus(status) {
        let badge = document.getElementById('headerSaveBadge');
        if (!badge) {
            const heading = document.querySelector('h2');
            if (heading) {
                badge = document.createElement('span');
                badge.id = 'headerSaveBadge';
                badge.style.cssText = 'margin-left:10px;font-size:0.75rem;transition:opacity 0.3s;';
                heading.appendChild(badge);
            }
        }
        if (!badge) return;
        if (status === 'saving') {
            badge.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="color:#94a3b8;"></i> Salvando...';
            badge.style.opacity = '1';
        } else if (status === 'saved') {
            badge.innerHTML = '<i class="fas fa-check" style="color:#22c55e;"></i> Salvo';
            badge.style.opacity = '1';
            setTimeout(() => { badge.style.opacity = '0'; }, 2500);
        } else if (status === 'error') {
            badge.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i> Erro';
            badge.style.opacity = '1';
        }
    }

    async function autoSaveItemField(tr, fieldName, value) {
        const itemId = tr.dataset.itemId;
        if (!_currentOrcamentoId || !itemId) return;

        showRowSaveStatus(tr, 'saving');
        try {
            const resp = await fetch(`/api/orcamentos/${_currentOrcamentoId}/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [fieldName]: value }),
            });
            if (resp.ok) {
                showRowSaveStatus(tr, 'saved');
            } else {
                showRowSaveStatus(tr, 'error');
            }
        } catch (e) {
            console.error('Auto-save item error:', e);
            showRowSaveStatus(tr, 'error');
        }
    }

    async function autoSaveHeader(field, value) {
        if (!_currentOrcamentoId) return;
        showHeaderSaveStatus('saving');
        try {
            const resp = await fetch(`/api/orcamentos/${_currentOrcamentoId}/header`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            });
            if (resp.ok) {
                showHeaderSaveStatus('saved');
            } else {
                showHeaderSaveStatus('error');
            }
        } catch (e) {
            console.error('Auto-save header error:', e);
            showHeaderSaveStatus('error');
        }
    }

    async function autoCreateItem(tr, data) {
        if (!_currentOrcamentoId) return;
        showRowSaveStatus(tr, 'saving');
        try {
            const resp = await fetch(`/api/orcamentos/${_currentOrcamentoId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const json = await resp.json();
            if (json.success && json.item_id) {
                tr.dataset.itemId = json.item_id;
                showRowSaveStatus(tr, 'saved');
            } else {
                showRowSaveStatus(tr, 'error');
            }
        } catch (e) {
            console.error('Auto-create item error:', e);
            showRowSaveStatus(tr, 'error');
        }
    }

    // ========================================================================
    // HEADER AUTO-SAVE — attach blur to header fields
    // ========================================================================
    if (_currentOrcamentoId) {
        const headerFields = [
            { el: 'titulo', field: 'titulo' },
            { el: 'solicitante_nome', field: 'solicitante_nome' },
            { el: 'solicitante_cnpj', field: 'solicitante_cnpj' },
            { el: 'variacao_maxima', field: 'variacao_maxima' },
        ];
        headerFields.forEach(({ el, field }) => {
            const input = document.getElementById(el);
            if (input) {
                input.addEventListener('blur', () => {
                    if (_headerSaveTimer) clearTimeout(_headerSaveTimer);
                    _headerSaveTimer = setTimeout(() => autoSaveHeader(field, input.value), 300);
                });
            }
        });

        // Selects (empresa + template)
        ['empresa1_id', 'empresa2_id', 'empresa3_id'].forEach(field => {
            const sel = document.getElementById(field);
            if (sel) {
                sel.addEventListener('change', () => {
                    autoSaveHeader(field, sel.value);
                });
            }
        });
    }

    // ========================================================================
    // ITEMS TABLE
    // ========================================================================

    try {
        const tableBody = document.querySelector('#itemsTable tbody');
        const addItemBtn = document.getElementById('addItemBtn');
        let itemIndex = 0;
        let nextCodigo = 1;

        if (tableBody && addItemBtn) {
            /**
             * Creates a new table row with all 7 columns + metrics panel
             * @param {Object} data - Item data (optional fields)
             */
            window.createRow = function(data) {
                data = data || {};
                const idx = itemIndex;
                const codigo = data.codigo || nextCodigo;
                const desc = data.descricao || '';
                const qty = data.quantidade || '1';
                const vCompra = data.valor_compra || '';
                const vVenda = data.valor_venda || '';
                const autoPreco = data.auto_preco == 1 || data.auto_preco === true;
                const marca = data.marca_modelo || '';
                const link = data.link_compra || '';
                const dbItemId = data.id || null;

                // Calculate predicted price for display
                const compraFloat = parseFloat(vCompra);
                const predictedPrice = compraFloat > 0 ? calcularPrecoVenda(compraFloat) : null;

                const tr = document.createElement('tr');
                tr.className = 'rich-row';
                tr.dataset.idx = idx;
                if (dbItemId) tr.dataset.itemId = dbItemId;

                tr.innerHTML = `
                    <td class="cell-codigo">
                        <input type="number" name="items[${idx}][codigo]" value="${codigo}" class="input-codigo" min="1">
                    </td>
                    <td class="cell-desc">
                        <div class="desc-wrapper">
                            <textarea name="items[${idx}][descricao]" placeholder="Descrição do item" class="input-desc" rows="1">${desc}</textarea>
                            <button type="button" class="btn-expand-desc" title="Expandir Descrição">
                                <i class="fas fa-expand-arrows-alt"></i>
                            </button>
                        </div>
                    </td>
                    <td class="cell-qty">
                        <input type="number" name="items[${idx}][quantidade]" value="${qty}" step="0.01" min="0.01" placeholder="1" class="input-qty">
                    </td>
                    <td class="cell-compra">
                        <div class="input-money-wrapper">
                            <span class="money-prefix">R$</span>
                            <input type="number" name="items[${idx}][valor_compra]" value="${vCompra}" step="0.01" min="0.01" placeholder="0,00" class="input-compra">
                        </div>
                    </td>
                    <td class="cell-venda">
                        <span class="predicted-price" title="Valor previsto pelo motor de precificação">${predictedPrice ? 'Previsto: R$ ' + predictedPrice.toFixed(2).replace('.', ',') : ''}</span>
                        <div class="venda-group">
                            <div class="input-money-wrapper">
                                <span class="money-prefix">R$</span>
                                <input type="number" name="items[${idx}][valor_venda]" value="${vVenda}" step="0.01" min="0.01" placeholder="0,00" class="input-venda" ${autoPreco ? 'readonly' : ''}>
                            </div>
                            <input type="hidden" name="items[${idx}][auto_preco]" value="${autoPreco ? '1' : '0'}" class="hidden-auto">
                            <button type="button" class="auto-toggle ${autoPreco ? 'active' : ''}" title="Auto-calcular preço de venda">
                                <i class="fas ${autoPreco ? 'fa-lock' : 'fa-magic'}"></i>
                            </button>
                        </div>
                    </td>
                    <td class="cell-marca">
                        <input type="text" name="items[${idx}][marca_modelo]" value="${marca}" placeholder="Ex: Samsung X200" class="input-marca">
                    </td>
                    <td class="cell-link">
                        <div class="link-group">
                            <input type="url" name="items[${idx}][link_compra]" value="${link}" placeholder="https://..." class="input-link">
                            <a href="${link || '#'}" target="_blank" class="link-preview ${link ? '' : 'hidden'}" title="Abrir link">
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                        </div>
                    </td>
                    <td class="cell-actions">
                        <button type="button" class="btn-icon btn-remove remove-row" title="Remover Item">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;

                // Metrics panel row - built via DOM API for reliable class assignment
                const metricsRow = document.createElement('tr');
                metricsRow.className = 'metrics-row';
                metricsRow.dataset.parentIdx = idx;

                const metricsTd = document.createElement('td');
                metricsTd.setAttribute('colspan', '8');

                const panel = document.createElement('div');
                panel.className = 'metrics-panel';

                // Build each metric element explicitly
                const lucroItem = document.createElement('div');
                lucroItem.className = 'metric-item';
                const lucroLabel = document.createElement('span');
                lucroLabel.className = 'metric-label';
                lucroLabel.textContent = 'Lucro Bruto';
                const lucroValSpan = document.createElement('span');
                lucroValSpan.className = 'metric-value';
                lucroValSpan.setAttribute('data-role', 'lucro-val');
                lucroValSpan.textContent = '\u2014';
                lucroItem.appendChild(lucroLabel);
                lucroItem.appendChild(lucroValSpan);

                const lucroPctItem = document.createElement('div');
                lucroPctItem.className = 'metric-item';
                const lucroPctLabel = document.createElement('span');
                lucroPctLabel.className = 'metric-label';
                lucroPctLabel.textContent = '% Lucro';
                const lucroPctSpan = document.createElement('span');
                lucroPctSpan.classList.add('metric-badge', 'tier-none');
                lucroPctSpan.setAttribute('data-role', 'lucro-pct');
                lucroPctSpan.textContent = '\u2014';
                lucroPctItem.appendChild(lucroPctLabel);
                lucroPctItem.appendChild(lucroPctSpan);

                const comPctItem = document.createElement('div');
                comPctItem.className = 'metric-item';
                const comPctLabel = document.createElement('span');
                comPctLabel.className = 'metric-label';
                comPctLabel.textContent = '% Comissão';
                const comPctSpan = document.createElement('span');
                comPctSpan.classList.add('metric-badge', 'tier-none');
                comPctSpan.setAttribute('data-role', 'comissao-pct');
                comPctSpan.textContent = '\u2014';
                comPctItem.appendChild(comPctLabel);
                comPctItem.appendChild(comPctSpan);

                const comValItem = document.createElement('div');
                comValItem.className = 'metric-item';
                const comValLabel = document.createElement('span');
                comValLabel.className = 'metric-label';
                comValLabel.textContent = 'Comissão (R$)';
                const comValSpan = document.createElement('span');
                comValSpan.className = 'metric-value';
                comValSpan.setAttribute('data-role', 'comissao-val');
                comValSpan.textContent = '\u2014';
                comValItem.appendChild(comValLabel);
                comValItem.appendChild(comValSpan);

                panel.appendChild(lucroItem);
                panel.appendChild(lucroPctItem);
                panel.appendChild(comPctItem);
                panel.appendChild(comValItem);

                metricsTd.appendChild(panel);
                metricsRow.appendChild(metricsTd);

                tableBody.appendChild(tr);
                tableBody.appendChild(metricsRow);

                // Auto-grow textarea
                const textarea = tr.querySelector('.input-desc');
                textarea.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = this.scrollHeight + 'px';
                });

                // Expand description button
                const expandBtn = tr.querySelector('.btn-expand-desc');
                if (expandBtn) {
                    expandBtn.addEventListener('click', function() {
                        if (typeof Swal !== 'undefined') {
                            Swal.fire({
                                title: 'Descrição do Item',
                                input: 'textarea',
                                inputValue: textarea.value,
                                inputPlaceholder: 'Digite a descrição completa...',
                                inputAttributes: {
                                    'aria-label': 'Descrição completa'
                                },
                                showCancelButton: true,
                                confirmButtonText: 'Salvar',
                                cancelButtonText: 'Cancelar',
                                customClass: {
                                    input: 'swal-desc-textarea'
                                }
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    textarea.value = result.value;
                                    textarea.style.height = 'auto';
                                    textarea.style.height = textarea.scrollHeight + 'px';
                                }
                            });
                        } else {
                            const newDesc = prompt('Descrição do Item:', textarea.value);
                            if (newDesc !== null) {
                                textarea.value = newDesc;
                                textarea.style.height = 'auto';
                                textarea.style.height = textarea.scrollHeight + 'px';
                            }
                        }
                    });
                }

                // Link preview update
                const linkInput = tr.querySelector('.input-link');
                const linkPreview = tr.querySelector('.link-preview');
                linkInput.addEventListener('input', function() {
                    if (this.value) {
                        linkPreview.href = this.value;
                        linkPreview.classList.remove('hidden');
                    } else {
                        linkPreview.classList.add('hidden');
                    }
                });

                // Auto-toggle button
                const autoBtn = tr.querySelector('.auto-toggle');
                const vendaInput = tr.querySelector('.input-venda');
                const hiddenAuto = tr.querySelector('.hidden-auto');
                const compraInput = tr.querySelector('.input-compra');

                autoBtn.addEventListener('click', function() {
                    const isActive = this.classList.toggle('active');
                    hiddenAuto.value = isActive ? '1' : '0';
                    const icon = this.querySelector('i');

                    if (isActive) {
                        icon.className = 'fas fa-lock';
                        vendaInput.readOnly = true;
                        vendaInput.classList.add('readonly');
                        const compra = parseFloat(compraInput.value);
                        if (compra > 0) {
                            const venda = calcularPrecoVenda(compra);
                            if (venda !== null) vendaInput.value = venda.toFixed(2);
                        }
                    } else {
                        icon.className = 'fas fa-magic';
                        vendaInput.readOnly = false;
                        vendaInput.classList.remove('readonly');
                    }
                    updateMetrics(tr, metricsRow);
                    updateSummary();
                });

                // Real-time recalc on inputs
                const predictedSpan = tr.querySelector('.predicted-price');

                function updatePredictedPrice() {
                    const c = parseFloat(compraInput.value);
                    if (c > 0) {
                        const pp = calcularPrecoVenda(c);
                        if (pp !== null) {
                            predictedSpan.textContent = 'Previsto: R$ ' + pp.toFixed(2).replace('.', ',');
                        } else {
                            predictedSpan.textContent = '';
                        }
                    } else {
                        predictedSpan.textContent = '';
                    }
                }

                compraInput.addEventListener('input', function() {
                    if (autoBtn.classList.contains('active')) {
                        const compra = parseFloat(this.value);
                        if (compra > 0) {
                            const venda = calcularPrecoVenda(compra);
                            if (venda !== null) vendaInput.value = venda.toFixed(2);
                        } else {
                            vendaInput.value = '';
                        }
                    }
                    updatePredictedPrice();
                    updateMetrics(tr, metricsRow);
                    updateSummary();
                });

                vendaInput.addEventListener('input', function() {
                    updateMetrics(tr, metricsRow);
                    updateSummary();
                });

                tr.querySelector('.input-qty').addEventListener('input', function() {
                    updateMetrics(tr, metricsRow);
                    updateSummary();
                });

                // ── Auto-save on blur ──
                function getRowData() {
                    return {
                        codigo: tr.querySelector('.input-codigo').value,
                        descricao: tr.querySelector('.input-desc').value,
                        quantidade: tr.querySelector('.input-qty').value,
                        valor_compra: compraInput.value,
                        valor_venda: vendaInput.value,
                        auto_preco: hiddenAuto.value,
                        marca_modelo: tr.querySelector('.input-marca').value,
                        link_compra: tr.querySelector('.input-link').value,
                    };
                }

                function handleFieldBlur(fieldName, inputEl) {
                    if (!_currentOrcamentoId) return;
                    const key = idx + '_' + fieldName;
                    if (_saveDebounceTimers[key]) clearTimeout(_saveDebounceTimers[key]);
                    _saveDebounceTimers[key] = setTimeout(() => {
                        if (tr.dataset.itemId) {
                            autoSaveItemField(tr, fieldName, inputEl.value);
                        } else {
                            // Create item first
                            autoCreateItem(tr, getRowData());
                        }
                    }, 300);
                }

                // Attach blur to all fields
                tr.querySelector('.input-codigo').addEventListener('blur', function() { handleFieldBlur('codigo', this); });
                tr.querySelector('.input-desc').addEventListener('blur', function() { handleFieldBlur('descricao', this); });
                tr.querySelector('.input-qty').addEventListener('blur', function() { handleFieldBlur('quantidade', this); });
                compraInput.addEventListener('blur', function() { handleFieldBlur('valor_compra', this); });
                vendaInput.addEventListener('blur', function() { handleFieldBlur('valor_venda', this); });
                tr.querySelector('.input-marca').addEventListener('blur', function() { handleFieldBlur('marca_modelo', this); });
                tr.querySelector('.input-link').addEventListener('blur', function() { handleFieldBlur('link_compra', this); });

                // Initial metrics if editing
                if (vCompra && vVenda) {
                    if (autoPreco) {
                        vendaInput.classList.add('readonly');
                    }
                    updateMetrics(tr, metricsRow);
                }

                nextCodigo = Math.max(nextCodigo, codigo + 1);
                itemIndex++;
                updateSummary();
            };

            function updateMetrics(dataRow, metricsRow) {
                const compra = parseFloat(dataRow.querySelector('.input-compra').value) || 0;
                const venda = parseFloat(dataRow.querySelector('.input-venda').value) || 0;
                const qty = parseFloat(dataRow.querySelector('.input-qty').value) || 0;

                const lucroBrutoUnit = venda - compra;
                const lucroBrutoTotal = lucroBrutoUnit * qty;
                const margemLucro = venda > 0 ? lucroBrutoUnit / venda : 0;
                const taxaComissao = calcularComissao(margemLucro);
                const comissaoValor = taxaComissao !== null ? taxaComissao * lucroBrutoTotal : 0;

                const lucroValEl = metricsRow.querySelector('[data-role="lucro-val"]');
                const lucroPctEl = metricsRow.querySelector('[data-role="lucro-pct"]');
                const comissaoPctEl = metricsRow.querySelector('[data-role="comissao-pct"]');
                const comissaoValEl = metricsRow.querySelector('[data-role="comissao-val"]');

                if (!lucroValEl || !lucroPctEl || !comissaoPctEl || !comissaoValEl) return;

                if (compra > 0 && venda > 0) {
                    lucroValEl.textContent = formatBRL(lucroBrutoTotal);
                    lucroPctEl.textContent = formatPct(margemLucro);

                    // Color-code lucro
                    lucroPctEl.className = 'metric-badge';
                    if (margemLucro < 0.20) lucroPctEl.classList.add('tier-1');
                    else if (margemLucro < 0.30) lucroPctEl.classList.add('tier-3');
                    else lucroPctEl.classList.add('tier-5');

                    const tier = getComissaoTier(taxaComissao);
                    comissaoPctEl.textContent = tier.label;
                    comissaoPctEl.className = 'metric-badge ' + tier.cls;

                    comissaoValEl.textContent = formatBRL(comissaoValor);
                } else {
                    lucroValEl.textContent = '\u2014';
                    lucroPctEl.textContent = '\u2014';
                    lucroPctEl.className = 'metric-badge tier-none';
                    comissaoPctEl.textContent = '\u2014';
                    comissaoPctEl.className = 'metric-badge tier-none';
                    comissaoValEl.textContent = '\u2014';
                }
            }

            function updateSummary() {
                const rows = tableBody.querySelectorAll('.rich-row');
                let totalCompra = 0, totalVenda = 0, totalLucro = 0, totalComissao = 0;
                let count = 0;

                rows.forEach(row => {
                    const compra = parseFloat(row.querySelector('.input-compra').value) || 0;
                    const venda = parseFloat(row.querySelector('.input-venda').value) || 0;
                    const qty = parseFloat(row.querySelector('.input-qty').value) || 0;

                    totalCompra += compra * qty;
                    totalVenda += venda * qty;

                    const lucroUnit = venda - compra;
                    const lucroTotal = lucroUnit * qty;
                    totalLucro += lucroTotal;

                    const margem = venda > 0 ? lucroUnit / venda : 0;
                    const taxa = calcularComissao(margem);
                    if (taxa !== null) totalComissao += taxa * lucroTotal;

                    count++;
                });

                const el = (id) => document.getElementById(id);
                el('summaryCount').textContent = count;
                el('summaryCompra').textContent = formatBRL(totalCompra);
                el('summaryVenda').textContent = formatBRL(totalVenda);
                el('summaryLucro').textContent = formatBRL(totalLucro);
                el('summaryComissao').textContent = formatBRL(totalComissao);
            }

            // Initial row
            if (tableBody.children.length === 0) createRow();

            addItemBtn.addEventListener('click', () => createRow());

            tableBody.addEventListener('click', async function(e) {
                if (e.target.closest('.remove-row')) {
                    const tr = e.target.closest('tr');
                    const itemId = tr.dataset.itemId;
                    const metricsRow = tr.nextElementSibling;
                    if (metricsRow && metricsRow.classList.contains('metrics-row')) {
                        metricsRow.remove();
                    }
                    tr.remove();
                    updateSummary();

                    // Auto-delete from backend
                    if (_currentOrcamentoId && itemId) {
                        try {
                            await fetch(`/api/orcamentos/${_currentOrcamentoId}/items/${itemId}`, { method: 'DELETE' });
                        } catch (e) {
                            console.error('Delete item error:', e);
                        }
                    }
                }
            });

            // Form Submit — allow saving without filling everything
            const form = document.getElementById('quoteForm');
            if (form) {
                form.addEventListener('submit', function(e) {
                    // ── CRITICAL: Cancel all pending auto-saves to prevent race condition ──
                    // When clicking Save, blur fires first → starts debounce timer →
                    // form submits → server deletes+reinserts items → then the debounced
                    // auto-save arrives and creates a DUPLICATE. Fix: kill all timers.
                    Object.keys(_saveDebounceTimers).forEach(key => {
                        clearTimeout(_saveDebounceTimers[key]);
                    });
                    _saveDebounceTimers = {};
                    if (_headerSaveTimer) {
                        clearTimeout(_headerSaveTimer);
                        _headerSaveTimer = null;
                    }
                    _currentOrcamentoId = null; // Prevent any new auto-saves from firing

                    // Only title is truly required
                    const titulo = document.getElementById('titulo');
                    if (titulo && !titulo.value.trim()) {
                        e.preventDefault();
                        // Restore auto-save since we're staying on the page
                        _currentOrcamentoId = _quoteIdInput ? _quoteIdInput.value : null;
                        showAlert('O título do orçamento é obrigatório.', 'Erro', 'error');
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error in Items Table Logic:", e);
    }

    // ========================================================================
    // CSV IMPORT
    // ========================================================================

    try {
        const importBtn = document.getElementById('importBtn');
        const csvInput = document.getElementById('csvInput');
        const csvFile = document.getElementById('csvFile');
        const tableBody = document.querySelector('#itemsTable tbody');

        if (importBtn && (csvInput || csvFile)) {
             importBtn.addEventListener('click', function() {
                if (csvFile && csvFile.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = function(e) { processImportContent(e.target.result); };
                    reader.readAsText(csvFile.files[0]);
                    return;
                } else if (csvInput && csvInput.value.trim() !== "") {
                    processImportContent(csvInput.value);
                } else {
                    showAlert('Cole o CSV ou selecione um arquivo.', 'Nenhum dado', 'warning');
                    return;
                }
            });

            function parseCSVLine(line, delimiter) {
                const result = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];

                    if (char === '"') {
                        if (inQuotes && line[i + 1] === '"') {
                            current += '"';
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === delimiter && !inQuotes) {
                        result.push(current);
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current);
                return result;
            }

            function processImportContent(text) {
                if (!window.createRow || !tableBody) return;
                
                tableBody.innerHTML = '';
                
                let addedCount = 0;
                const lines = text.split(/\r\n|\n/);
                const firstLine = lines[0] || '';
                const semicolonCount = (firstLine.match(/;/g) || []).length;
                const commaCount = (firstLine.match(/,/g) || []).length;
                const delimiter = semicolonCount >= commaCount ? ';' : ',';

                lines.forEach((line, index) => {
                    if (!line.trim()) return;
                    const lineLower = line.toLowerCase();
                    if (index === 0 && (lineLower.includes('desc') || lineLower.includes('qty') || lineLower.includes('pre') || lineLower.includes('quant'))) {
                         return;
                    }
                    
                    const parts = parseCSVLine(line, delimiter);
                    if (parts.length >= 2) {
                        let desc = parts[0].trim();
                        let qty = '1', vCompra = '0', marca = '';

                        if (parts.length >= 4) {
                            qty = parts[1].trim().replace(',', '.');
                            vCompra = parts[2].trim().replace(/[^\d.,]/g, '').replace(',', '.');
                            marca = parts[3].trim();
                        } else if (parts.length >= 3) {
                            qty = parts[1].trim().replace(',', '.');
                            vCompra = parts[2].trim().replace(/[^\d.,]/g, '').replace(',', '.');
                        } else {
                            qty = parts[1].trim().replace(',', '.');
                        }

                        createRow({
                            descricao: desc,
                            quantidade: qty,
                            valor_compra: vCompra,
                            marca_modelo: marca
                        });
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    const manualRadio = document.getElementById('mode_manual');
                    if (manualRadio) {
                        manualRadio.checked = true;
                        toggleItemMode();
                    }
                    showAlert(`${addedCount} itens importados!`, 'Sucesso', 'success');
                } else {
                    showAlert('Nenhum item válido identificado no CSV.', 'Erro', 'error');
                }
            }
        }
    } catch (e) {
        console.error("Error in CSV Logic:", e);
    }

    // ========================================================================
    // TEMPLATE MODAL
    // ========================================================================

    try {
        const modal = document.getElementById('templateModal');
        const closeBtn = document.querySelector('.close-modal');
        const buttons = document.querySelectorAll('.select-template-btn');

        if (modal && buttons.length > 0) {
            let currentTargetInputId = null;

            buttons.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    currentTargetInputId = this.dataset.target;
                    modal.style.display = 'block';
                });
            });

            if (closeBtn) {
                closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
            }

            window.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });

            const templateItems = document.querySelectorAll('.template-item');
            templateItems.forEach(item => {
                item.addEventListener('click', function() {
                    const templateId = this.dataset.id;
                    if (currentTargetInputId) {
                         const input = document.getElementById(currentTargetInputId);
                         if (input) input.value = templateId;
                         
                         const btn = document.querySelector(`button[data-target="${currentTargetInputId}"]`);
                         if (btn) btn.innerHTML = `Modelo ${templateId} (Selecionado) <i class="fas fa-check"></i>`;
                    }
                    modal.style.display = 'none';
                });
            });
        } else {
            console.warn("Modal elements not found");
        }
    } catch (e) {
        console.error("Error in Modal Logic:", e);
    }
});
