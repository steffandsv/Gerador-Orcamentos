<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body { font-family: 'Courier New', Courier, monospace; background: #f0f4f8; padding: 40px; color: #2c3e50; }
        @page { size: A4; margin: 1.5cm; }
        .sheet { background: #fff; padding: 20px; border: 1px solid #bdc3c7; box-shadow: 5px 5px 0px rgba(0,0,0,0.1); }
        
        .header { display: flex; align-items: center; border-bottom: 2px dashed #bdc3c7; padding-bottom: 20px; margin-bottom: 20px; }
        .logo-box { width: 60px; height: 60px; background: #3498db; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-right: 20px; }
        .company-name { font-size: 24px; font-weight: bold; color: #34495e; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #ecf0f1; padding: 20px; }
        .label { font-size: 10px; color: #7f8c8d; text-transform: uppercase; }
        .value { font-weight: bold; }
        
        table { width: 100%; border: 1px solid #bdc3c7; border-collapse: collapse; }
        th { background: #34495e; color: #fff; padding: 10px; text-align: left; font-size: 12px; }
        td { border: 1px solid #bdc3c7; padding: 10px; font-size: 14px; }
        
        .total-row { background: #f1c40f; font-weight: bold; }
        
        .footer { margin-top: 40px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="header">
            <div class="logo-box">Qt</div>
            <div>
                <div class="company-name"><?= htmlspecialchars($company['nome']) ?></div>
                <div style="font-size: 12px;"><?= htmlspecialchars($company['email']) ?></div>
            </div>
        </div>
        
        <div class="info-grid">
            <div>
                <div class="label">Emissor</div>
                <div class="value">
                    <?= htmlspecialchars($company['nome']) ?><br>
                    <?= htmlspecialchars($company['endereco']) ?>
                </div>
            </div>
            <div>
                <div class="label">Detalhes do Orçamento</div>
                <div class="value">
                    Ref: <?= htmlspecialchars($quote['titulo']) ?><br>
                    Data: <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?><br>
                    ID: #<?= $quote['id'] ?>
                </div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>DESCRIÇÃO</th>
                    <th style="width: 50px; text-align: center;">UN</th>
                    <th style="width: 80px; text-align: center;">QTD</th>
                    <th style="width: 120px; text-align: right;">UNIT.</th>
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
                    <td colspan="3" style="text-align: right;">TOTAL A PAGAR</td>
                    <td style="text-align: right;">R$ <?= number_format($grandTotal, 2, ',', '.') ?></td>
                </tr>
            </tbody>
        </table>
        
        <div class="footer">
            <div class="label">Notas Adicionais</div>
            <?php if (!empty($company['detalhes_adicionais'])): ?>
                <?= $company['detalhes_adicionais'] ?>
            <?php else: ?>
                <p>Obrigado.</p>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
