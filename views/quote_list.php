<h2>Orçamentos Gerados</h2>
<div style="margin-bottom: 15px;">
    <a href="index.php?page=orcamento_form" class="btn">Novo Orçamento</a>
</div>

<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Data</th>
            <th>Título</th>
            <th>Vencedora</th>
            <th>Variação Max</th>
            <th>Ações</th>
        </tr>
    </thead>
    <tbody>
        <?php if (empty($orcamentos)): ?>
        <tr>
            <td colspan="6" style="text-align:center;">Nenhum orçamento cadastrado.</td>
        </tr>
        <?php else: ?>
            <?php foreach ($orcamentos as $orc): ?>
            <tr>
                <td><?= $orc['id'] ?></td>
                <td><?= date('d/m/Y H:i', strtotime($orc['data_criacao'])) ?></td>
                <td><?= htmlspecialchars($orc['titulo']) ?></td>
                <td><?= htmlspecialchars($orc['empresa_vencedora'] ?? 'N/A') ?></td>
                <td><?= $orc['variacao_maxima'] ?>%</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        <button onclick="generateQuotes(<?= $orc['id'] ?>)" class="btn btn-small" title="Gerar PDF">
                            <i class="fas fa-print"></i>
                        </button>
                        <button onclick="openEmailModal(<?= $orc['id'] ?>)" class="btn btn-small btn-primary" title="Enviar por Email" style="background:#2196F3;">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <a href="index.php?page=orcamento_form&id=<?= $orc['id'] ?>" class="btn btn-small btn-secondary" title="Editar">
                            <i class="fas fa-edit"></i>
                        </a>
                        <form action="index.php" method="POST" onsubmit="return confirm('Tem certeza que deseja excluir este orçamento?');" style="margin:0;">
                            <input type="hidden" name="action" value="delete_quote">
                            <input type="hidden" name="id" value="<?= $orc['id'] ?>">
                            <button type="submit" class="btn btn-small btn-danger" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </form>
                    </div>
                </td>
            </tr>
            <?php endforeach; ?>
        <?php endif; ?>
    </tbody>
</table>

<script>
}

function openEmailModal(id) {
    document.getElementById('emailModal').style.display = 'flex';
    document.getElementById('email_quote_id').value = id;
    document.getElementById('email_recipient').focus();
}

function closeEmailModal() {
    document.getElementById('emailModal').style.display = 'none';
    document.getElementById('statusMsg').style.display = 'none';
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('sendBtn').innerText = 'Enviar Orçamentos';
}

async function sendEmails() {
    const id = document.getElementById('email_quote_id').value;
    const recipient = document.getElementById('email_recipient').value;
    
    if (!recipient) {
        alert('Por favor, informe o email do destinatário.');
        return;
    }

    const btn = document.getElementById('sendBtn');
    const status = document.getElementById('statusMsg');
    
    btn.disabled = true;
    btn.innerText = 'Processando...';
    status.style.display = 'block';
    
    try {
        const formData = new FormData();
        formData.append('quote_id', id);
        formData.append('recipient_email', recipient);

        // Generate 3 PDFs
        for (let i = 1; i <= 3; i++) {
            status.innerText = `Gerando PDF da empresa ${i}/3...`;
            
            // 1. Fetch HTML of the layout
            const url = `index.php?page=print&id=${id}&company_index=${i}`;
            const response = await fetch(url);
            const html = await response.text();
            
            // 2. Render in hidden div
            const container = document.createElement('div');
            container.innerHTML = html;
            container.style.width = '800px'; // Forced A4 width approx
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            document.body.appendChild(container);
            
            // 3. Convert to PDF Blob
            // html2pdf options
            const opt = {
                margin: 10,
                filename: `orcamento_${id}_${i}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
            
            formData.append(`pdf${i}`, pdfBlob, `orcamento_${i}.pdf`);
            
            // Cleanup
            document.body.removeChild(container);
        }

        status.innerText = 'Enviando e-mail...';
        
        // Send to Backend
        const sendResponse = await fetch('index.php?action=send_budget', {
            method: 'POST',
            body: formData
        });
        
        const result = await sendResponse.json();
        
        if (result.success) {
            Swal.fire('Sucesso!', result.message, 'success');
            closeEmailModal();
        } else {
            Swal.fire('Erro!', result.message, 'error');
            btn.disabled = false;
            btn.innerText = 'Tentar Novamente';
        }

    } catch (err) {
        console.error(err);
        Swal.fire('Erro!', 'Ocorreu um erro ao processar o envio.', 'error');
        btn.disabled = false;
        btn.innerText = 'Enviar Orçamentos';
    }
}
</script>

<!-- Email Modal -->
<div id="emailModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
    <div style="background:#fff; padding:20px; border-radius:8px; width:400px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <h3>Enviar Orçamentos</h3>
        <p>Preencha o email do destinatário (Prefeitura/Solicitante).</p>
        
        <input type="hidden" id="email_quote_id">
        
        <label style="display:block; margin-bottom:5px;">Email Destino:</label>
        <input type="email" id="email_recipient" class="form-control" style="width:100%; padding:8px; margin-bottom:15px; border:1px solid #ccc; border-radius:4px;" placeholder="ex: licitacao@prefeitura.sp.gov.br">
        
        <div id="statusMsg" style="display:none; margin-bottom:10px; color:#666; font-size:0.9em;">Aguardando...</div>
        
        <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button onclick="closeEmailModal()" class="btn" style="background:#888;">Cancelar</button>
            <button onclick="sendEmails()" id="sendBtn" class="btn" style="background:#2196F3;">Enviar Orçamentos</button>
        </div>
    </div>
</div>
    // Open 3 tabs
    window.open('index.php?page=print&id=' + id + '&company_index=1', '_blank');
    // Small delay to ensure browser doesn't block popups if possible, though modern browsers block multiple automatic popups. 
    // The user might need to allow popups.
    setTimeout(() => {
        window.open('index.php?page=print&id=' + id + '&company_index=2', '_blank');
    }, 200);
    setTimeout(() => {
        window.open('index.php?page=print&id=' + id + '&company_index=3', '_blank');
    }, 400);
}
</script>
