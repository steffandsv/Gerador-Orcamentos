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
function generateQuotes(id) {
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
    const status = document.getElementById('statusMsg'); // Re-using existing statusMsg for simplicity, as the new code implies a dynamic status element not present in the modal.
    
    btn.disabled = true;
    btn.innerText = 'Processando...';
    status.style.display = 'block';
    status.innerText = 'Iniciando processo...'; // Set initial status

    try {
        // Create Overlay
        const overlay = document.createElement('div');
        overlay.id = 'pdf-generation-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.8)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.color = 'white';
        overlay.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 20px;">Gerando PDF <span id="overlay-counter">1</span>/3...</div>
            <div id="pdf-container-visible" style="background:white; width:790px; height:auto; padding:0; color:black; overflow:hidden; transform: scale(0.8); transform-origin: top center;"></div>
        `;
        document.body.appendChild(overlay);

        const container = document.getElementById('pdf-container-visible');
        const counter = document.getElementById('overlay-counter');
        const formData = new FormData();
        
        // Get email
        // Using 'recipient' variable already defined and validated
        formData.append('quote_id', id);
        formData.append('recipient_email', recipient); // Use 'recipient' from the modal input

        // Generate 3 PDFs sequentially
        for (let i = 1; i <= 3; i++) {
            counter.innerText = i;
            status.innerText = `Gerando PDF ${i}/3...`; // Update modal status as well
            
            // 1. Fetch HTML
            const url = `index.php?page=print&id=${id}&company_index=${i}`;
            const response = await fetch(url);
            const htmlText = await response.text();
            
            // 2. Parse & Insert into Visible Container
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            let css = '';
            doc.querySelectorAll('style').forEach(style => { css += style.innerHTML; });
            const bodyContent = doc.body.innerHTML;

            // Reset container content
            container.innerHTML = `<style>${css}</style><div class="pdf-content" style="padding:20px;">${bodyContent}</div>`;
            
            // Wait for render (crucial)
            await new Promise(r => setTimeout(r, 800));

            // 3. Generate PDF
            const opt = {
                margin: 0,
                filename: `orcamento_${id}_${i}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            const pdfBlob = await html2pdf().set(opt).from(container).output('blob');
            formData.append(`pdf${i}`, pdfBlob, `orcamento_${i}.pdf`);
            
            // Small pause
            await new Promise(r => setTimeout(r, 200));
        }

        document.body.removeChild(overlay); // Remove overlay after generation
        status.innerText = 'Enviando e-mail...';

        // Send to Backend
        const res = await fetch('index.php?action=send_budget', {
            method: 'POST',
            body: formData
        });

        const json = await res.json();
        
        if (json.success) {
            status.innerHTML = `<span style="color:green">✅ ${json.message}</span>`;
            if (json.details) {
                // console.log(json.details);
            }
            setTimeout(() => { closeEmailModal(); }, 2000); // Use existing close function
        } else {
            status.innerHTML = `<span style="color:red">❌ ${json.message}</span>`;
            if (json.details) {
                status.innerHTML += `<br><small>${json.details.join('<br>')}</small>`;
            }
            btn.disabled = false; // Re-enable button on error
            btn.innerText = 'Tentar Novamente';
        }

    } catch (err) {
        console.error(err);
        status.innerText = 'Erro: ' + err.message;
        const overlay = document.getElementById('pdf-generation-overlay');
        if(overlay) document.body.removeChild(overlay);
        btn.disabled = false; // Re-enable button on error
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
