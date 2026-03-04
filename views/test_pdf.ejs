<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Teste de PDF</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .btn { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
        #content-to-print {
            border: 1px solid #ccc;
            padding: 20px;
            width: 600px;
            background: #fff;
            margin-top: 20px;
        }
        .hidden-container {
            position: absolute;
            top: 0;
            left: 0;
            z-index: -1000; /* Behind everything */
            background: white;
            width: 800px; /* A4 width approx */
        }
    </style>
</head>
<body>
    <h1>Teste Isolado de Geração de PDF</h1>
    <p>Este teste verifica se a biblioteca html2pdf funciona no seu navegador.</p>
    
    <button onclick="generateVisible()" class="btn">Gerar PDF (Visível)</button>
    <button onclick="generateHidden()" class="btn" style="background:#28a745;">Gerar PDF (Oculto/Fix)</button>

    <div id="content-to-print">
        <h2>Olá, Mundo!</h2>
        <p>Este é um teste de conteúdo para PDF.</p>
        <p style="color:red;">Este texto deve ser vermelho.</p>
        <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
        </ul>
        <div style="background:#eee; padding:10px;">Caixa cinza</div>
    </div>

    <script>
        function generateVisible() {
            const element = document.getElementById('content-to-print');
            const opt = {
                margin: 10,
                filename: 'teste_visivel.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        }

        async function generateHidden() {
            // Simulate the fix technique
            const original = document.getElementById('content-to-print').innerHTML;
            
            const container = document.createElement('div');
            container.innerHTML = original;
            container.className = 'hidden-container';
            document.body.appendChild(container);

            const opt = {
                margin: 10,
                filename: 'teste_oculto_fix.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            await html2pdf().set(opt).from(container).save();
            
            document.body.removeChild(container);
        }
    </script>
</body>
</html>
