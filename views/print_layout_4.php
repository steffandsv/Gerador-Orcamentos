<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body { font-family: 'Open Sans', sans-serif; margin: 0; padding: 0; color: #333; }
        @page { size: A4; margin: 0; }
        .container { padding: 40px; }
        .header-bg { background: #2c3e50; color: #fff; padding: 40px; }
        .header-bg h1 { margin: 0; font-size: 32px; font-weight: 300; }
        .header-bg p { opacity: 0.8; font-size: 14px; }
        
        .meta-info { margin-top: 20px; display: flex; justify-content: space-between; padding: 0 40px; }
        .meta-box { background: #ecf0f1; padding: 15px; border-left: 5px solid #3498db; width: 45%; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 40px; }
        th { background: #3498db; color: #fff; padding: 15px; text-align: left; }
        td { padding: 15px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        
        .total { float: right; margin-top: 20px; font-size: 24px; font-weight: bold; color: #2c3e50; }
        .clearfix { clear: both; }
        
        .footer { background: #2c3e50; color: #fff; padding: 20px 40px; position: fixed; bottom: 0; left: 0; width: 100%; font-size: 12px; }
        .rich-text { margin: 40px; font-size: 14px; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="header-bg">
        <h1><?= htmlspecialchars($company['nome']) ?></h1>
        <p><?= htmlspecialchars($company['endereco']) ?> | <?= htmlspecialchars($company['email']) ?></p>
    </div>
    
    <div class="meta-info">
        <div class="meta-box">
            <strong>CLIENTE</strong><br>
            <strong>CLIENTE</strong><br>
            <?php if (!empty($quote['solicitante_nome'])): ?>
                <?= htmlspecialchars($quote['solicitante_nome']) ?><br>
                <?= htmlspecialchars($quote['solicitante_cnpj']) ?>
            <?php else: ?>
                A/C Departamento de Compras
            <?php endif; ?>
        </div>
        <div class="meta-box">
            <strong>ORÇAMENTO #<?= $quote['id'] ?></strong><br>
            Data: <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?><br>
            Ref: <?= htmlspecialchars($quote['titulo']) ?>
        </div>
    </div>
    
    <div class="container">
        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th style="width: 50px;">UN</th>
                    <th style="width: 80px;">Qtd</th>
                    <th style="width: 110px;">Unitário</th>
                    <th style="width: 110px;">Total</th>
                </tr>
            </thead>
            <tbody>
                <?php $grandTotal = 0; foreach ($items as $item): $grandTotal += $item['total_price']; ?>
                <tr>
                    <td><?= htmlspecialchars($item['descricao']) ?></td>
                    <td><?= htmlspecialchars($item['unidade'] ?? 'UN') ?></td>
                    <td><?= number_format($item['quantidade'], 2, ',', '.') ?></td>
                    <td>R$ <?= number_format($item['final_price'], 2, ',', '.') ?></td>
                    <td>R$ <?= number_format($item['total_price'], 2, ',', '.') ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        
        <div class="total">Total: R$ <?= number_format($grandTotal, 2, ',', '.') ?></div>
        <div class="clearfix"></div>
        
        <div class="rich-text">
            <?php if (!empty($company['detalhes_adicionais'])): ?>
                <?= $company['detalhes_adicionais'] ?>
            <?php else: ?>
                <p>Validade: 10 dias.</p>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
