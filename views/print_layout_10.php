<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Poppins', sans-serif;
            background: #fff;
            color: #333;
            padding: 40px;
        }
        @page { size: A4; margin: 1cm; }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        
        .header p {
            margin: 5px 0 0;
            font-size: 14px;
            opacity: 0.9;
        }
        
        .info-cards {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            flex: 1;
            background: #f8f9fa;
            border-left: 4px solid #764ba2;
            padding: 20px;
            border-radius: 8px;
        }
        
        .card-title {
            color: #764ba2;
            font-weight: 600;
            margin-bottom: 10px;
            font-size: 12px;
            text-transform: uppercase;
        }
        
        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 10px;
        }
        
        th {
            text-align: left;
            padding: 15px;
            color: #888;
            font-weight: 400;
            font-size: 14px;
        }
        
        td {
            background: #f8f9fa;
            padding: 15px;
            font-size: 14px;
        }
        
        tr td:first-child {
            border-top-left-radius: 10px;
            border-bottom-left-radius: 10px;
        }
        
        tr td:last-child {
            border-top-right-radius: 10px;
            border-bottom-right-radius: 10px;
            font-weight: 600;
            color: #764ba2;
        }
        
        .total-section {
            text-align: right;
            margin-top: 20px;
            padding: 20px;
            background: #764ba2;
            color: white;
            border-radius: 10px;
            font-size: 20px;
            font-weight: 600;
            display: inline-block;
            float: right;
        }
        
        .footer {
            clear: both;
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #aaa;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>

    <div class="header">
        <div>
            <h1><?= htmlspecialchars($company['nome']) ?></h1>
            <p><?= htmlspecialchars($company['email']) ?></p>
        </div>
        <div style="text-align: right;">
            <div style="font-size: 12px; opacity: 0.8;">ORÇAMENTO</div>
            <div style="font-size: 24px;">#<?= $quote['id'] ?></div>
        </div>
    </div>

    <div class="info-cards">
        <div class="card">
            <div class="card-title">Para</div>
            <div>Cliente Especial</div>
            <div>A/C Departamento de Compras</div>
        </div>
        <div class="card">
            <div class="card-title">Detalhes</div>
            <div><strong>Projeto:</strong> <?= htmlspecialchars($quote['titulo']) ?></div>
            <div><strong>Data:</strong> <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?></div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>DESCRIÇÃO</th>
                <th style="width: 50px; text-align: center;">UN</th>
                <th style="width: 80px; text-align: center;">QTD</th>
                <th style="width: 120px; text-align: right;">UNITÁRIO</th>
                <th style="width: 120px; text-align: right;">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            <?php $grandTotal = 0; foreach ($items as $item): $grandTotal += $item['total_price']; ?>
            <tr>
                <td><?= htmlspecialchars($item['descricao']) ?></td>
                <td style="text-align: center;"><?= htmlspecialchars($item['unidade'] ?? 'UN') ?></td>
                <td style="text-align: center;"><?= number_format($item['quantidade'], 2, ',', '.') ?></td>
                <td style="text-align: right;">R$ <?= number_format($item['final_price'], 2, ',', '.') ?></td>
                <td style="text-align: right;">R$ <?= number_format($item['total_price'], 2, ',', '.') ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <div class="total-section">
        Total: R$ <?= number_format($grandTotal, 2, ',', '.') ?>
    </div>

    <div class="footer">
        <?php if (!empty($company['detalhes_adicionais'])): ?>
            <?= $company['detalhes_adicionais'] ?>
        <?php else: ?>
            <p>Criatividade e Inovação. Validade da proposta: 10 dias.</p>
        <?php endif; ?>
    </div>

</body>
</html>
