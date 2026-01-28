<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Source Sans Pro', sans-serif;
            color: #000;
            padding: 60px;
        }
        @page { size: A4; margin: 2.5cm; }
        
        .header {
            text-align: center;
            margin-bottom: 60px;
        }
        
        .header h1 {
            font-family: 'Playfair Display', serif;
            font-size: 36px;
            margin: 0;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        
        .header .meta {
            margin-top: 10px;
            font-size: 12px;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        
        .divider {
            height: 2px;
            background: #000;
            width: 50px;
            margin: 20px auto;
        }
        
        .quote-details {
            margin-bottom: 40px;
            text-align: center;
        }
        
        table {
            width: 100%;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            border-collapse: collapse;
            margin-bottom: 40px;
        }
        
        th {
            font-family: 'Playfair Display', serif;
            text-align: left;
            padding: 15px 10px;
            border-bottom: 1px solid #000;
            font-size: 14px;
        }
        
        td {
            padding: 15px 10px;
            font-size: 13px;
        }
        
        .total-row td {
            font-weight: 600;
            font-size: 16px;
            border-top: 1px solid #000;
        }
        
        .signatures {
            margin-top: 80px;
            display: flex;
            justify-content: space-between;
            padding: 0 50px;
        }
        
        .sig {
            border-top: 1px solid #000;
            width: 40%;
            text-align: center;
            padding-top: 10px;
            font-size: 12px;
            text-transform: uppercase;
        }
    </style>
</head>
<body>

    <div class="header">
        <h1><?= htmlspecialchars($company['nome']) ?></h1>
        <div class="divider"></div>
        <div class="meta">
            <?= htmlspecialchars($company['endereco']) ?><br>
            
        </div>
    </div>
    
    <div class="quote-details">
        <strong>PROPOSTA COMERCIAL #<?= $quote['id'] ?></strong><br>
        REFERÊNCIA: <?= htmlspecialchars($quote['titulo']) ?><br>
        DATA: <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?>
        <?php if (!empty($quote['solicitante_nome'])): ?>
            <br><br>
            <strong>SOLICITANTE:</strong> <?= htmlspecialchars($quote['solicitante_nome']) ?> (<?= htmlspecialchars($quote['solicitante_cnpj']) ?>)
        <?php endif; ?>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>ITEM</th>
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
                <td style="text-align: right;"><?= number_format($item['final_price'], 2, ',', '.') ?></td>
                <td style="text-align: right;"><?= number_format($item['total_price'], 2, ',', '.') ?></td>
            </tr>
            <?php endforeach; ?>
            <tr class="total-row">
                <td colspan="4" style="text-align: right; padding-right: 20px;">TOTAL FINAL</td>
                <td style="text-align: right;"><?= number_format($grandTotal, 2, ',', '.') ?></td>
            </tr>
        </tbody>
    </table>
    
    <div class="signatures">
        <div class="sig">Assinatura do Responsável</div>
        <div class="sig">De Acordo (Cliente)</div>
    </div>

</body>
</html>
