<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body { font-family: 'Arial Black', Arial, sans-serif; padding: 40px; color: #000; }
        @page { size: A4; margin: 2cm; }
        .header { border-bottom: 5px solid #d00; padding-bottom: 10px; margin-bottom: 30px; }
        .header h1 { font-size: 40px; margin: 0; letter-spacing: -2px; text-transform: uppercase; color: #d00; }
        .sub-header { display: flex; justify-content: space-between; font-family: Arial, sans-serif; margin-bottom: 40px; }
        
        .quote-id { font-size: 60px; color: #eee; font-weight: bold; position: absolute; top: 20px; right: 40px; z-index: -1; }
        
        table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; }
        th { background: #000; color: #fff; padding: 10px; text-align: left; }
        td { border-bottom: 1px solid #000; padding: 10px; }
        
        .total { text-align: right; font-size: 28px; color: #d00; margin-top: 20px; font-weight: bold; }
        
        .footer-notes { margin-top: 50px; font-family: Arial, sans-serif; font-size: 12px; border-top: 1px solid #ccc; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="quote-id">#<?= $quote['id'] ?></div>
    
    <div class="header">
        <h1><?= htmlspecialchars($company['nome']) ?></h1>
    </div>
    
    <div class="sub-header">
        <div>
            <strong>De:</strong><br>
            <?= htmlspecialchars($company['endereco']) ?><br>
            
        </div>
        <div style="text-align: right;">
            <strong>Para:</strong><br>
            <?php if (!empty($quote['solicitante_nome'])): ?>
                <?= htmlspecialchars($quote['solicitante_nome']) ?><br>
                <?= htmlspecialchars($quote['solicitante_cnpj']) ?><br>
            <?php else: ?>
                Cliente<br>
            <?php endif; ?>
            Data: <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?>
        </div>
    </div>
    
    <h2 style="font-family: Arial, sans-serif; border-left: 5px solid #000; padding-left: 10px;"><?= htmlspecialchars($quote['titulo']) ?></h2>
    
    <table>
        <thead>
            <tr>
                <th>ITEM</th>
                <th style="width: 50px;">UN</th>
                <th style="width: 80px;">QTD</th>
                <th style="width: 120px;">UNIT.</th>
                <th style="width: 120px; text-align: right;">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            <?php $grandTotal = 0; foreach ($items as $item): $grandTotal += $item['total_price']; ?>
            <tr>
                <td><?= htmlspecialchars($item['descricao']) ?></td>
                <td><?= htmlspecialchars($item['unidade'] ?? 'UN') ?></td>
                <td><?= number_format($item['quantidade'], 2, ',', '.') ?></td>
                <td><?= number_format($item['final_price'], 2, ',', '.') ?></td>
                <td style="text-align: right;"><?= number_format($item['total_price'], 2, ',', '.') ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
    
    <div class="total">
        R$ <?= number_format($grandTotal, 2, ',', '.') ?>
    </div>
    
    <div class="footer-notes">
        <?php if (!empty($company['detalhes_adicionais'])): ?>
            <?= $company['detalhes_adicionais'] ?>
        <?php else: ?>
            <p>Este orçamento é válido por 30 dias.</p>
        <?php endif; ?>
    </div>
</body>
</html>
