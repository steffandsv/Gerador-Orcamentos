<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Lato', sans-serif;
            color: #2c3e50;
            padding: 50px;
        }
        @page { size: A4; margin: 2cm; }
        
        .header {
            border-bottom: 2px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 40px;
        }
        
        .logo {
            font-size: 24px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #2c3e50;
        }
        
        .sub-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            font-size: 14px;
        }
        
        .column {
            width: 45%;
        }
        
        .column h4 {
            margin: 0 0 10px 0;
            color: #7f8c8d;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 1px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        
        th {
            background: #2c3e50;
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 12px;
            text-transform: uppercase;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
            font-size: 13px;
        }
        
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        
        .total-box {
            text-align: right;
        }
        
        .total-label {
            font-size: 12px;
            color: #7f8c8d;
            text-transform: uppercase;
        }
        
        .total-value {
            font-size: 28px;
            font-weight: 700;
            color: #2c3e50;
            margin-top: 5px;
        }
        
        .footer {
            margin-top: 60px;
            font-size: 11px;
            color: #95a5a6;
            text-align: center;
        }
    </style>
</head>
<body>

    <div class="header">
        <div class="logo"><?= htmlspecialchars($company['nome']) ?></div>
    </div>
    
    <div class="sub-header">
        <div class="column">
            <h4>De</h4>
            <strong><?= htmlspecialchars($company['nome']) ?></strong><br>
            <?= htmlspecialchars($company['endereco']) ?><br>
            <?= htmlspecialchars($company['email']) ?>
        </div>
        <div class="column" style="text-align: right;">
            <h4>Orçamento</h4>
            <strong>Ref: <?= htmlspecialchars($quote['titulo']) ?></strong><br>
            Número: #<?= $quote['id'] ?><br>
            Data: <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Descrição</th>
                <th style="width: 50px; text-align: center;">Unid</th>
                <th style="width: 80px; text-align: center;">Qtd</th>
                <th style="width: 120px; text-align: right;">Preço Unit.</th>
                <th style="width: 120px; text-align: right;">Total</th>
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
    
    <div class="total-box">
        <div class="total-label">Valor Total</div>
        <div class="total-value">R$ <?= number_format($grandTotal, 2, ',', '.') ?></div>
    </div>
    
    <div class="footer">
        <?php if (!empty($company['detalhes_adicionais'])): ?>
            <?= $company['detalhes_adicionais'] ?>
        <?php else: ?>
            Este documento é um orçamento e não vale como recibo de pagamento.
        <?php endif; ?>
    </div>

</body>
</html>
