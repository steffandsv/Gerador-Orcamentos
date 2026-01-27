<h2>Novo Orçamento</h2>

<form action="index.php?page=orcamentos" method="POST" id="quoteForm">
    <input type="hidden" name="action" value="save_quote">

    <div class="card">
        <label>Título do Orçamento:</label>
        <input type="text" name="titulo" required placeholder="Ex: Material de Escritório - Julho/2024">

        <div class="flex-row" style="align-items: flex-start;">
            <div class="flex-col">
                <label>Empresa Vencedora (Menor Preço):</label>
                <select name="empresa1_id" required>
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
                <label>Empresa 2 (Orçamento Superior):</label>
                <select name="empresa2_id" required>
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
                <label>Empresa 3 (Orçamento Superior):</label>
                <select name="empresa3_id" required>
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

        <label style="margin-top: 15px;">Variação Máxima (%) para os outros orçamentos:</label>
        <input type="number" name="variacao_maxima" value="10" min="1" max="100" required step="0.1">
        <small style="display:block; margin-top:-10px; margin-bottom:15px; color:#666;">
            Os preços das empresas 2 e 3 serão aleatoriamente maiores entre 1% e X% em relação à vencedora.
        </small>
    </div>

    <div class="card">
        <h3>Importar Itens</h3>
        <p style="font-size: 0.9em; color: #666;">Cole os dados (CSV) abaixo ou envie um arquivo. <a href="#" id="downloadTemplate" style="color: #0066cc;">Baixar Modelo CSV</a></p>
        <p style="font-size: 0.8em; color: #888;">Formatos aceitos: <strong>Descrição;Unidade;Quantidade;Preço</strong> ou <strong>Descrição;Quantidade;Preço</strong> (Unit será 'UN')</p>
        <textarea id="csvInput" rows="3" placeholder="Caneta Azul;UN;100;1.50" style="font-family: monospace;"></textarea>
        <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
            <input type="file" id="csvFile" accept=".csv" style="border: 1px solid #ddd; padding: 5px;">
            <button type="button" class="btn" id="importBtn" style="background: #28a745;">Importar Itens</button>
        </div>
    </div>

    <div class="card">
        <h3>Itens do Orçamento</h3>
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
        <button type="button" class="btn" id="addItemBtn">+ Adicionar Item</button>
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
                <div class="preview-frame-container" style="height:300px; overflow:hidden; border:1px solid #eee; position:relative;">
                    <!-- Loading iframe lazily would be better, but for now simple -->
                    <iframe src="preview_template.php?template_id=<?= $i ?>" style="width:100%; height:100%; border:none; pointer-events:none; transform:scale(0.5); transform-origin:0 0; width:200%; height:200%;"></iframe>
                    <div style="position:absolute; top:0; left:0; width:100%; height:100%;"></div>
                </div>
            </div>
            <?php endfor; ?>
        </div>
    </div>
</div>

<script src="js/script.js"></script>
