<h2>Novo Orçamento</h2>

<form action="index.php?page=orcamentos" method="POST" id="quoteForm">
    <input type="hidden" name="action" value="save_quote">

    <div class="card">
        <label for="titulo">Título do Orçamento:</label>
        <input type="text" id="titulo" name="titulo" required placeholder="Ex: Material de Escritório - Julho/2024">
        
        <div class="flex-row" style="margin-top: 15px;">
            <div class="flex-col">
                <label for="solicitante_nome">Nome do Solicitante:</label>
                <input type="text" id="solicitante_nome" name="solicitante_nome" required placeholder="Ex: Prefeitura Municipal de X">
            </div>
             <div class="flex-col">
                <label for="solicitante_cnpj">CNPJ do Solicitante:</label>
                <input type="text" id="solicitante_cnpj" name="solicitante_cnpj" required placeholder="Ex: 00.000.000/0001-00">
            </div>
        </div>

        <div class="flex-row" style="align-items: flex-start;">
            <div class="flex-col">
                <label for="empresa1_id">Empresa Vencedora (Menor Preço):</label>
                <select name="empresa1_id" id="empresa1_id" class="company-select" required>
                    <option value="">Selecione...</option>
                    <?php foreach ($empresas as $emp): ?>
                        <option value="<?= $emp['id'] ?>"><?= htmlspecialchars($emp['nome']) ?></option>
                    <?php endforeach; ?>
                </select>
                <label style="margin-top: 10px;">Modelo de Layout:</label>
                <input type="hidden" name="template1_id" id="template1_id" value="1">
                <button type="button" class="btn btn-secondary select-template-btn" data-target="template1_id">Modelo 1 (Selecionado)</button>
            </div>
            <div class="flex-col">
                <label for="empresa2_id">Empresa 2 (Orçamento Superior):</label>
                <select name="empresa2_id" id="empresa2_id" class="company-select" required>
                    <option value="">Selecione...</option>
                    <?php foreach ($empresas as $emp): ?>
                        <option value="<?= $emp['id'] ?>"><?= htmlspecialchars($emp['nome']) ?></option>
                    <?php endforeach; ?>
                </select>
                <label style="margin-top: 10px;">Modelo de Layout:</label>
                <input type="hidden" name="template2_id" id="template2_id" value="2">
                <button type="button" class="btn btn-secondary select-template-btn" data-target="template2_id">Modelo 2 (Selecionado)</button>
            </div>
            <div class="flex-col">
                <label for="empresa3_id">Empresa 3 (Orçamento Superior):</label>
                <select name="empresa3_id" id="empresa3_id" class="company-select" required>
                    <option value="">Selecione...</option>
                    <?php foreach ($empresas as $emp): ?>
                        <option value="<?= $emp['id'] ?>"><?= htmlspecialchars($emp['nome']) ?></option>
                    <?php endforeach; ?>
                </select>
                <label style="margin-top: 10px;">Modelo de Layout:</label>
                <input type="hidden" name="template3_id" id="template3_id" value="3">
                <button type="button" class="btn btn-secondary select-template-btn" data-target="template3_id">Modelo 3 (Selecionado)</button>
            </div>
        </div>

        <label for="variacao_maxima" style="margin-top: 15px;">Variação Máxima (%) para os outros orçamentos:</label>
        <input type="number" name="variacao_maxima" value="10" min="1" max="100" required step="0.1">
        <small style="display:block; margin-top:-10px; margin-bottom:15px; color:#666;">
            Os preços das empresas 2 e 3 serão aleatoriamente maiores entre 1% e X% em relação à vencedora.
        </small>
    </div>

    <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3>Itens do Orçamento</h3>
            <div class="toggle-container">
                <label class="switch-label">Modo:</label>
                <div class="switch-wrapper">
                    <input type="radio" name="item_mode" id="mode_import" value="import" checked onchange="toggleItemMode()">
                    <label for="mode_import" class="switch-btn">Importar (CSV)</label>
                    <input type="radio" name="item_mode" id="mode_manual" value="manual" onchange="toggleItemMode()">
                    <label for="mode_manual" class="switch-btn">Manual</label>
                </div>
            </div>
        </div>

        <div id="importSection">
            <p style="font-size: 0.9em; color: #666;">Cole os dados (CSV) abaixo ou envie um arquivo e clique em "Processar" para preencher a tabela.</p>
            <p style="font-size: 0.8em; color: #888;">Formatos: <strong>Descrição;Unidade;Quantidade;Preço</strong> ou <strong>Descrição;Quantidade;Preço</strong> (Unit será 'UN')</p>
            <textarea id="csvInput" rows="3" placeholder="Caneta Azul;CX;10;15.50" style="font-family: monospace; width:100%; box-sizing:border-box;"></textarea>
            <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
                <input type="file" id="csvFile" accept=".csv" style="border: 1px solid #ddd; padding: 5px;">
                <button type="button" class="btn" id="importBtn" style="background: #007bff;">Processar e Preencher Tabela</button>
                <a href="#" id="downloadTemplate" style="color: #0066cc; margin-left:auto;">Baixar Modelo CSV</a>
            </div>
        </div>

        <div id="manualSection" style="margin-top:20px;">
            <table id="itemsTable">
                <thead>
                    <tr>
                        <th style="width: 40%;">Descrição</th>
                        <th style="width: 10%;">Unidade</th>
                        <th style="width: 15%;">Qtd</th>
                        <th style="width: 20%;">Preço Unit. (Vencedora)</th>
                        <th style="width: 15%;">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Rows added by JS -->
                </tbody>
            </table>
            <button type="button" class="btn" id="addItemBtn" style="margin-top:10px;">+ Adicionar Item</button>
        </div>
    </div>

    <div style="margin-top: 20px;">
        <button type="submit" class="btn" style="font-size:1.1rem;">Salvar e Gerar Orçamentos</button>
    </div>
</form>

<!-- Template Selection Modal -->
<div id="templateModal" class="modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; overflow:auto; background-color:rgba(0,0,0,0.5);">
    <div class="modal-content" style="background-color:#fefefe; margin:5% auto; padding:20px; border:1px solid #888; width:90%; max-width:1200px; border-radius:8px;">
        <span class="close-modal" style="color:#aaa; float:right; font-size:28px; font-weight:bold; cursor:pointer;">&times;</span>
        <h2>Selecione um Modelo</h2>
        <div class="template-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:20px; padding:20px 0;">
            <!-- Templates will be loaded here -->
            <?php for($i=1; $i<=12; $i++): ?>
            <div class="template-item" data-id="<?= $i ?>" style="border:1px solid #ddd; padding:10px; cursor:pointer; transition:0.3s;">
                <h4 style="margin:0 0 10px 0; text-align:center;">Modelo <?= $i ?></h4>
                <div class="preview-frame-container" style="height:350px; overflow:hidden; border:1px solid #eee; position:relative; background:#f0f0f0;">
                    <!-- Loading iframe lazily would be better, but for now simple -->
                    <iframe title="Preview do Modelo <?= $i ?>" src="preview_template.php?template_id=<?= $i ?>" style="width:100%; height:100%; border:none; pointer-events:none; transform:scale(0.25); transform-origin:0 0; width:400%; height:400%; background:white;"></iframe>
                    <div style="position:absolute; top:0; left:0; width:100%; height:100%; cursor:pointer;"></div>
                </div>
            </div>
            <?php endfor; ?>
        </div>
    </div>
</div>

<script src="js/script.js"></script>
<script>
    // --- Solicitante Logic implemented directly here or can be moved to script.js if needed ---

    // --- Smart Import Logic ---
    function toggleItemMode() {
        // Since we unified them, we just show/hide the import input area? 
        // Actually client asked for a Switch. 
        // "Importar" default -> shows CSV input. "Manual" -> shows just table? 
        // But Import fills table. So table must ALWAYS be visible in "Manual" mode, 
        // and in "Import" mode we show the CSV entry + the table (as preview of what was imported).
        // Let's interpret: 
        // Import Mode: Show CSV Input area.
        // Manual Mode: Hide CSV Input area. 
        // Table is always shown to see the items.
        
        const mode = document.querySelector('input[name="item_mode"]:checked').value;
        const importSection = document.getElementById('importSection');
        
        if (mode === 'import') {
            importSection.style.display = 'block';
        } else {
            importSection.style.display = 'none';
        }
    }
    
    // Initialize
    toggleItemMode();

    // --- Company Unique Selection Logic ---
    const selects = document.querySelectorAll('.company-select');
    
    function updateCompanyOptions() {
        const selectedValues = Array.from(selects).map(s => s.value).filter(v => v);
        
        selects.forEach(select => {
            const currentVal = select.value;
            const options = select.querySelectorAll('option');
            
            // Re-enable all first
            options.forEach(opt => {
                if (opt.value) opt.disabled = false;
            });

            // Disable if selected elsewhere
            options.forEach(opt => {
                if (opt.value && selectedValues.includes(opt.value) && opt.value !== currentVal) {
                    opt.disabled = true;
                }
            });
        });

        // Auto selection if only 1 option left
        selects.forEach(select => {
            if (!select.value) {
                const available = Array.from(select.querySelectorAll('option')).filter(opt => !opt.disabled && opt.value);
                if (available.length === 1) {
                    select.value = available[0].value;
                    // Trigger change to update others
                    updateCompanyOptions();
                }
            }
        });
    }

    selects.forEach(s => s.addEventListener('change', updateCompanyOptions));
    // Run once on load
    updateCompanyOptions();

</script>
