<h2><?= $empresa ? 'Editar' : 'Nova' ?> Empresa</h2>

<form action="index.php?page=empresas" method="POST" class="card" id="companyForm">
    <input type="hidden" name="action" value="save_company">
    <?php if ($empresa): ?>
        <input type="hidden" name="id" value="<?= $empresa['id'] ?>">
    <?php endif; ?>

    <label>Nome da Empresa:</label>
    <input type="text" name="nome" required value="<?= $empresa['nome'] ?? '' ?>">

    <label>Documento (CNPJ/CPF):</label>
    <input type="text" name="documento" value="<?= $empresa['documento'] ?? '' ?>">

    <label>Endereço:</label>
    <textarea name="endereco" rows="3"><?= $empresa['endereco'] ?? '' ?></textarea>

    <div class="flex-row">
        <div class="flex-col">
            <label>Telefone:</label>
            <input type="text" name="telefone" value="<?= $empresa['telefone'] ?? '' ?>">
        </div>
        <div class="flex-col">
            <label>Email:</label>
            <input type="email" name="email" value="<?= $empresa['email'] ?? '' ?>">
        </div>
    </div>

    <label>Detalhes Adicionais (Substitui o texto de validade da proposta):</label>
    <div class="rte-container" style="border: 1px solid #ccc; border-radius: 4px; overflow: hidden; margin-bottom: 15px;">
        <div class="rte-toolbar" style="background: #f0f0f0; padding: 5px; border-bottom: 1px solid #ccc;">
            <button type="button" onclick="execCmd('bold')" title="Negrito"><b>B</b></button>
            <button type="button" onclick="execCmd('italic')" title="Itálico"><i>I</i></button>
            <button type="button" onclick="execCmd('underline')" title="Sublinhado"><u>U</u></button>
            <button type="button" onclick="execCmd('createLink', prompt('Entre com a URL:', 'http://'))" title="Link">🔗</button>
            <button type="button" onclick="execCmd('insertImage', prompt('Entre com a URL da imagem:', 'http://'))" title="Imagem">🖼️</button>
            <button type="button" onclick="execCmd('formatBlock', 'h3')" title="Cabeçalho">H3</button>
            <button type="button" onclick="execCmd('removeFormat')" title="Limpar Formatação">🧹</button>
        </div>
        <div id="editor" contenteditable="true" style="padding: 10px; min-height: 150px; background: #fff;">
            <?= $empresa['detalhes_adicionais'] ?? '' ?>
        </div>
    </div>
    <input type="hidden" name="detalhes_adicionais" id="detalhes_adicionais">

    <button type="submit" class="btn">Salvar Empresa</button>
    <a href="index.php?page=empresas" class="btn" style="background:#888;">Cancelar</a>
</form>

<script>
    function execCmd(command, value = null) {
        document.execCommand(command, false, value);
    }

    document.getElementById('companyForm').addEventListener('submit', function() {
        document.getElementById('detalhes_adicionais').value = document.getElementById('editor').innerHTML;
    });
</script>

<style>
    .rte-toolbar button {
        cursor: pointer;
        padding: 5px 10px;
        margin-right: 2px;
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 3px;
    }
    .rte-toolbar button:hover {
        background: #e0e0e0;
    }
</style>
