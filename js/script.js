document.addEventListener('DOMContentLoaded', function() {
    // Helper for SweetAlert or Fallback
    const showAlert = (message, title = 'Atenção', icon = 'info') => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ title, text: message, icon, confirmButtonColor: '#3b82f6' });
        } else {
            alert(message);
        }
    };

    // 1. Items Table Logic
    try {
        const tableBody = document.querySelector('#itemsTable tbody');
        const addItemBtn = document.getElementById('addItemBtn');
        let itemIndex = 0;

        // If table exists, proceed
        if (tableBody && addItemBtn) {
            window.createRow = function(desc = '', unit = 'UN', qty = '', price = '') {
                // Ensure values are safe
                unit = unit || 'UN';
                qty = qty || '1';
                price = price || '0.00';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <input type="text" name="items[${itemIndex}][descricao]" value="${desc}" placeholder="Descrição do item" class="form-control" required style="width:100%">
                    </td>
                    <td>
                        <input type="text" name="items[${itemIndex}][unidade]" value="${unit}" placeholder="UN" class="form-control" required style="width:100%; text-align:center;">
                    </td>
                    <td>
                        <input type="number" name="items[${itemIndex}][quantidade]" value="${qty}" step="0.01" min="0.01" placeholder="1" class="form-control" required style="width:100%">
                    </td>
                    <td>
                        <input type="number" name="items[${itemIndex}][preco_unitario]" value="${price}" step="0.01" min="0.01" placeholder="0.00" class="form-control" required style="width:100%">
                    </td>
                    <td style="text-align:center;">
                        <button type="button" class="btn btn-small btn-danger remove-row" title="Remover Item">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(tr);
                itemIndex++;
            };

            // Initial row
            if (tableBody.children.length === 0) createRow();

            addItemBtn.addEventListener('click', () => createRow());

            tableBody.addEventListener('click', function(e) {
                if (e.target.closest('.remove-row')) {
                    e.target.closest('tr').remove();
                }
            });

            // Form Submit Validation
            const form = document.getElementById('quoteForm');
            if (form) {
                form.addEventListener('submit', function(e) {
                    const rows = tableBody.querySelectorAll('tr');
                    if (rows.length === 0) {
                        e.preventDefault();
                        showAlert('Adicione pelo menos um item ao orçamento.', 'Erro', 'error');
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error in Items Table Loop:", e);
    }

    // 2. CSV Import Logic
    try {
        const importBtn = document.getElementById('importBtn');
        const csvInput = document.getElementById('csvInput');
        const csvFile = document.getElementById('csvFile');
        const tableBody = document.querySelector('#itemsTable tbody'); // Re-select to be safe

        if (importBtn && (csvInput || csvFile)) {
             importBtn.addEventListener('click', function() {
                let csvText = '';
                
                if (csvFile && csvFile.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = function(e) { processImportContent(e.target.result); };
                    reader.readAsText(csvFile.files[0]);
                    return;
                } else if (csvInput && csvInput.value.trim() !== "") {
                    csvText = csvInput.value;
                } else {
                    showAlert('Cole o CSV ou selecione um arquivo.', 'Nenhum dado', 'warning');
                    return;
                }
                processImportContent(csvText);
            });

            function processImportContent(text) {
                if (!window.createRow || !tableBody) return;
                
                tableBody.innerHTML = '';
                // itemIndex global reset? We used closure variable itemIndex.
                // We can't easily reset closure variable unless we expose reset.
                // Just continue incrementing, keys will be unique enough.
                
                let addedCount = 0;
                const lines = text.split(/\r\n|\n/);
                const firstLine = lines[0] || '';
                const semicolonCount = (firstLine.match(/;/g) || []).length;
                const commaCount = (firstLine.match(/,/g) || []).length;
                const delimiter = semicolonCount >= commaCount ? ';' : ',';

                lines.forEach((line, index) => {
                    if (!line.trim()) return;
                    // Header check
                    const lineLower = line.toLowerCase();
                    if (index === 0 && (lineLower.includes('desc') || lineLower.includes('qty') || lineLower.includes('pre') || lineLower.includes('unid'))) {
                         return;
                    }
                    
                    const parts = line.split(delimiter);
                    if (parts.length >= 2) {
                        let desc = parts[0].trim().replace(/^"|"$/g, '');
                        let unit = 'UN', qty = '1', price = '0';

                        // Heuristic Layout detection
                        if (parts.length >= 4) { // Desc; Unit; Qty; Price
                            unit = parts[1]; qty = parts[2]; price = parts[3];
                        } else if (parts.length === 3) { 
                             // Desc; Qty; Price OR Desc; Unit; Qty
                             // Check 2nd col for number
                             let p2 = parts[1].trim();
                             if (isNaN(parseFloat(p2.replace(',','.')))) {
                                 unit = p2; qty = parts[2]; // Desc; Unit; Qty (No price?)
                             } else {
                                 qty = p2; price = parts[2]; // Desc; Qty; Price
                             }
                        } else {
                            qty = parts[1]; // Desc; Qty
                        }

                        // Cleanups
                        if (typeof unit === 'string') unit = unit.replace(/^"|"$/g, '').trim();
                        if (typeof qty === 'string') qty = qty.replace(/^"|"$/g, '').replace(',', '.').trim();
                        if (typeof price === 'string') price = price.replace(/^"|"$/g, '').replace(/[^\d.,]/g, '').replace(',', '.').trim();

                        createRow(desc, unit, qty, price);
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    const manualRadio = document.getElementById('mode_manual');
                    if (manualRadio) {
                        manualRadio.checked = true;
                        // Trigger change
                        toggleItemMode(); // function defined in HTML script
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

    // 3. Modal Logic
    try {
        const modal = document.getElementById('templateModal');
        const closeBtn = document.querySelector('.close-modal');
        const buttons = document.querySelectorAll('.select-template-btn');

        if (modal && buttons.length > 0) {
            let currentTargetInputId = null;

            buttons.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault(); // Just in case
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

            // Template Item Click
            const templateItems = document.querySelectorAll('.template-item');
            templateItems.forEach(item => {
                item.addEventListener('click', function() {
                    const templateId = this.dataset.id;
                    if (currentTargetInputId) {
                         const input = document.getElementById(currentTargetInputId);
                         if (input) input.value = templateId;
                         
                         // Update Button Text
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
