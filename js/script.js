document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.querySelector('#itemsTable tbody');
    const addItemBtn = document.getElementById('addItemBtn');
    let itemIndex = 0;

    function createRow(desc = '', unit = 'UN', qty = '', price = '') {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <input type="text" name="items[${itemIndex}][descricao]" required value="${desc}" placeholder="Item..." style="margin-bottom:0;">
            </td>
            <td>
                <input type="text" name="items[${itemIndex}][unidade]" required value="${unit}" placeholder="UN" style="margin-bottom:0; text-align:center;">
            </td>
            <td>
                <input type="number" name="items[${itemIndex}][quantidade]" required value="${qty}" step="0.01" min="0.01" placeholder="1" style="margin-bottom:0;">
            </td>
            <td>
                <input type="number" name="items[${itemIndex}][preco_unitario]" required value="${price}" step="0.01" min="0.01" placeholder="0.00" style="margin-bottom:0;">
            </td>
            <td>
                <button type="button" class="btn btn-small btn-danger remove-row">X</button>
            </td>
        `;
        tableBody.appendChild(tr);
        itemIndex++;
    }

    // Add first row by default
    createRow();

    addItemBtn.addEventListener('click', () => createRow());

    tableBody.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-row')) {
            e.target.closest('tr').remove();
        }
    });

    // Simple validation before submit
    document.getElementById('quoteForm').addEventListener('submit', function(e) {
        const rows = tableBody.querySelectorAll('tr');
        if (rows.length === 0) {
            e.preventDefault();
            alert('Adicione pelo menos um item ao orçamento.');
        }
    });

    // CSV Logic
    const downloadTemplateBtn = document.getElementById('downloadTemplate');
    const importBtn = document.getElementById('importBtn');
    const csvInput = document.getElementById('csvInput');
    const csvFile = document.getElementById('csvFile');

    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const csvContent = "Descrição;Unidade;Quantidade;Preço Unitário\nCaneta Azul;UN;100;1.50\nPapel A4;CX;50;25.00";
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "modelo_itens.csv");
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });
    }

    if (importBtn) {
        function parseCSV(text) {
            const lines = text.split(/\r\n|\n/);
            // Detect delimiter: count semicolons vs commas in first line
            const firstLine = lines[0] || '';
            const semicolonCount = (firstLine.match(/;/g) || []).length;
            const commaCount = (firstLine.match(/,/g) || []).length;
            const delimiter = semicolonCount >= commaCount ? ';' : ',';
    
            let addedCount = 0;
    
            lines.forEach((line, index) => {
                if (!line.trim()) return;
                // Skip header if it looks like header
                if (index === 0 && (line.toLowerCase().includes('desc') || line.toLowerCase().includes('qty') || line.toLowerCase().includes('quant') || line.toLowerCase().includes('pre'))) {
                    return;
                }
    
                const parts = line.split(delimiter);
                if (parts.length >= 1) {
                    const desc = parts[0].trim().replace(/^"|"$/g, '');
                    let unit = 'UN';
                    let qty = '1';
                    let price = '0';

                    if (parts.length >= 4) {
                        // Desc; Unit; Qty; Price
                        unit = parts[1].trim().replace(/^"|"$/g, '');
                        qty = parts[2].trim().replace(/^"|"$/g, '');
                        price = parts[3].trim().replace(/^"|"$/g, '');
                    } else if (parts.length === 3) {
                        // Desc; Qty; Price
                        // Try to detect if the second col is Unit or Qty. Qty is usually numeric.
                        const secondCol = parts[1].trim().replace(/^"|"$/g, '');
                        if (isNaN(parseFloat(secondCol.replace(',', '.')))) {
                             // It's likely a unit
                             unit = secondCol;
                             qty = parts[2].trim().replace(/^"|"$/g, ''); // Then 3rd must be Price? Wait if 3 cols and 2nd is unit, where is Qty?
                             // 3 cols logic usually: Desc; Qty; Price OR Desc; Unit; Qty (missing price?)
                             // Let's assume standard 3 cols is Desc; Qty; Price as per request.
                        } else {
                             qty = secondCol;
                             price = parts[2].trim().replace(/^"|"$/g, '');
                        }
                    } else if (parts.length === 2) {
                         qty = parts[1].trim().replace(/^"|"$/g, '');
                    }
                    
                    // Handle comma as decimal separator
                    if (qty.includes(',') && !qty.includes('.')) qty = qty.replace(',', '.');
                    if (price.includes(',') && !price.includes('.')) price = price.replace(',', '.');
                    
                    // Cleanup symbols like R$ or $
                    price = price.replace(/[^\d.]/g, '');
    
                    createRow(desc, unit, qty, price);
                    addedCount++;
                }
            });
    
            if (addedCount > 0) {
                alert(addedCount + ' itens importados com sucesso!');
            } else {
                alert('Nenhum item válido encontrado.');
            }
        }

        importBtn.addEventListener('click', function() {
            let csvText = '';
            if (csvFile.files.length > 0) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    processImport(e.target.result);
                };
                reader.readAsText(csvFile.files[0]);
                return; // processing async
            } else if (csvInput.value.trim() !== "") {
                csvText = csvInput.value;
            } else {
                alert('Por favor, cole o CSV ou selecione um arquivo.');
                return;
            }
            processImport(csvText);
        });

        function processImport(text) {
             // Clear existing items
             tableBody.innerHTML = '';
             itemIndex = 0;
             
             parseCSV(text);
             
             // Switch to Manual Mode
             const manualRadio = document.getElementById('mode_manual');
             if (manualRadio) {
                 manualRadio.checked = true;
                 // Trigger change event to update UI
                 const event = new Event('change');
                 manualRadio.dispatchEvent(event);
             }
        }
    }

    // Modal Logic
    const modal = document.getElementById('templateModal');
    const closeBtn = document.querySelector('.close-modal');
    let currentTargetInputId = null;

    if (modal) {
        document.querySelectorAll('.select-template-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                currentTargetInputId = this.dataset.target;
                modal.style.display = 'block';
            });
        });

        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        document.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', function() {
                const templateId = this.dataset.id;
                if (currentTargetInputId) {
                    const input = document.getElementById(currentTargetInputId);
                    if (input) {
                        input.value = templateId;
                        // Update button text
                        const btn = document.querySelector(`button[data-target="${currentTargetInputId}"]`);
                        if (btn) btn.textContent = `Modelo ${templateId} (Selecionado)`;
                    }
                }
                modal.style.display = 'none';
            });
        });
    }
});
