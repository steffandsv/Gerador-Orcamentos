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

    <fieldset style="border: 1px solid #ddd; padding: 10px; margin-bottom: 15px; border-radius: 4px;">
        <legend>Configurações de E-mail (SMTP)</legend>
        <div class="flex-row">
            <div class="flex-col">
                <label>Servidor SMTP (Host):</label>
                <input type="text" name="smtp_host" id="smtp_host" value="<?= $empresa['smtp_host'] ?? '' ?>" placeholder="smtp.gmail.com">
            </div>
            <div class="flex-col" style="max-width: 100px;">
                <label>Porta:</label>
                <input type="text" name="smtp_port" id="smtp_port" value="<?= $empresa['smtp_port'] ?? '587' ?>">
            </div>
        </div>
        <div class="flex-row">
            <div class="flex-col">
                <label>Usuário SMTP:</label>
                <input type="text" name="smtp_user" id="smtp_user" value="<?= $empresa['smtp_user'] ?? '' ?>">
            </div>
            <div class="flex-col">
                <label>Senha SMTP:</label>
                <input type="password" name="smtp_pass" id="smtp_pass" value="<?= $empresa['smtp_pass'] ?? '' ?>">
            </div>
        </div>
        <div class="flex-row">
            <div class="flex-col">
                <label>Segurança:</label>
                <select name="smtp_secure" id="smtp_secure">
                    <option value="tls" <?= ($empresa['smtp_secure'] ?? '') == 'tls' ? 'selected' : '' ?>>TLS (Padrão Gmail)</option>
                    <option value="ssl" <?= ($empresa['smtp_secure'] ?? '') == 'ssl' ? 'selected' : '' ?>>SSL</option>
                    <option value="none" <?= ($empresa['smtp_secure'] ?? '') == 'none' ? 'selected' : '' ?>>Nenhuma</option>
                </select>
            </div>
            <div class="flex-col" style="justify-content: flex-end;">
                <button type="button" class="btn" onclick="testSMTP()" style="background: #2196F3;">Testar Configuração</button>
            </div>
        </div>
        <div id="smtp-test-result" style="margin-top: 10px; padding: 10px; display: none; border-radius: 4px;"></div>
    </fieldset>

    <button type="submit" class="btn">Salvar Empresa</button>
    <a href="index.php?page=empresas" class="btn" style="background:#888;">Cancelar</a>
</form>

<script>
    function execCmd(command, value = null) {
        document.execCommand(command, false, value);
    }

    function testSMTP() {
        const resultDiv = document.getElementById('smtp-test-result');
        resultDiv.style.display = 'block';
        resultDiv.style.background = '#f0f0f0';
        resultDiv.innerHTML = 'Testando conexão... aguarde.';
        
        const data = {
            host: document.getElementById('smtp_host').value,
            port: document.getElementById('smtp_port').value,
            user: document.getElementById('smtp_user').value,
            pass: document.getElementById('smtp_pass').value,
            secure: document.getElementById('smtp_secure').value
        };

        fetch('index.php?action=test_smtp', {
            method: 'POST',
            body: new URLSearchParams(data)
        })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                resultDiv.style.background = '#dff0d8';
                resultDiv.style.color = '#3c763d';
                resultDiv.innerHTML = '✅ ' + res.message;
            } else {
                resultDiv.style.background = '#f2dede';
                resultDiv.style.color = '#a94442';
                resultDiv.innerHTML = '❌ ' + res.message;
            }
        })
        .catch(err => {
            resultDiv.style.background = '#f2dede';
            resultDiv.innerHTML = 'Erro na requisição: ' + err;
        });
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
