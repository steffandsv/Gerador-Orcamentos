<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body { font-family: 'Verdana', sans-serif; padding: 30px; background: #eef2f3; }
        @page { size: A4; margin: 1cm; }
        .page-container { background: #fff; padding: 40px; border: 1px solid #ccc; box-shadow: 0 0 10px rgba(0,0,0,0.1); min-height: 900px; }
        
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .logo { background: #34495e; color: #fff; padding: 20px; font-weight: bold; font-size: 24px; }
        .details { text-align: right; font-size: 12px; line-height: 1.5; }
        
        .title-bar { background: #34495e; color: #fff; padding: 10px 20px; font-size: 18px; margin-bottom: 20px; border-radius: 4px; }
        
        table { width: 100%; border-spacing: 0; margin-bottom: 30px; border: 1px solid #ddd; }
        th { background: #f2f2f2; padding: 12px; text-align: left; border-bottom: 1px solid #ddd; font-size: 12px; color: #555; }
        td { padding: 12px; border-bottom: 1px solid #ddd; font-size: 13px; }
        tr:last-child td { border-bottom: none; }
        
        .summary { float: right; width: 300px; border: 1px solid #ddd; padding: 15px; background: #f9f9f9; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .summary-total { font-weight: bold; font-size: 16px; color: #34495e; border-top: 1px solid #ccc; padding-top: 10px; }
        
        .notes { margin-top: 20px; border-left: 4px solid #34495e; padding-left: 15px; color: #666; font-size: 13px; }
        
        .clear { clear: both; }
    </style>
</head>
<body>
    <div class="page-container">
        <div class="header">
            <div class="logo"><?= htmlspecialchars($company['nome']) ?></div>
            <div class="details">
                <?= htmlspecialchars($company['endereco']) ?><br>
                <?= htmlspecialchars($company['documento']) ?><br>
                <?= htmlspecialchars($company['email']) ?><br>
                <?= htmlspecialchars($company['telefone']) ?>
            </div>
        </div>
        
        <div class="title-bar">
            Orçamento #<?= $quote['id'] ?> - <?= htmlspecialchars($quote['titulo']) ?>
        </div>
        
        <p><strong>Data de Emissão:</strong> <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?></p>
        
        <table>
            <thead>
                <tr>
                    <th>DESCRIÇÃO</th>
                    <th style="width: 50px; text-align: center;">UN</th>
                    <th style="width: 80px; text-align: center;">QTD</th>
                    <th style="width: 120px; text-align: right;">PREÇO UNIT.</th>
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
            </tbody>
        </table>
        
        <div class="summary">
            <div class="summary-row">
                <span>Subtotal:</span>
                <span>R$ <?= number_format($grandTotal, 2, ',', '.') ?></span>
            </div>
            <div class="summary-row summary-total">
                <span>Total a Pagar:</span>
                <span>R$ <?= number_format($grandTotal, 2, ',', '.') ?></span>
            </div>
        </div>
        
        <div class="clear"></div>
        
        <div class="notes">
            <strong>Observações:</strong><br>
            <?php if (!empty($company['detalhes_adicionais'])): ?>
                <?= $company['detalhes_adicionais'] ?>
            <?php else: ?>
                Obrigado pela preferência!
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
