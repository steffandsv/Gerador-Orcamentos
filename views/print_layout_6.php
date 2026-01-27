<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body { font-family: Georgia, 'Times New Roman', Times, serif; padding: 50px; background: #fdfdfd; color: #1a1a1a; }
        @page { size: A4; margin: 2.5cm; }
        .header { text-align: center; border-bottom: 1px solid #27ae60; padding-bottom: 20px; margin-bottom: 40px; }
        .header h1 { color: #27ae60; margin: 0; font-size: 32px; font-weight: normal; letter-spacing: 1px; }
        .header p { font-style: italic; color: #7f8c8d; }
        
        .quote-title { text-align: center; font-size: 18px; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th { border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; padding: 15px; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
        td { padding: 15px; border-bottom: 1px solid #eee; }
        
        .total-section { text-align: right; font-size: 20px; color: #27ae60; border-top: 2px solid #27ae60; padding-top: 10px; display: inline-block; float: right; width: 100%; }
        
        .terms { margin-top: 80px; font-size: 14px; color: #555; }
        .terms h4 { border-bottom: 1px solid #ddd; padding-bottom: 5px; display: inline-block; }
    </style>
</head>
<body>
    <div class="header">
        <h1><?= htmlspecialchars($company['nome']) ?></h1>
        <p><?= htmlspecialchars($company['endereco']) ?> | <?= htmlspecialchars($company['telefone']) ?></p>
    </div>
    
    <div class="quote-title">
        Orçamento #<?= $quote['id'] ?> &mdash; <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?>
    </div>
    
    <h3 style="text-align: center; font-weight: normal;"><?= htmlspecialchars($quote['titulo']) ?></h3>
    
    <table>
        <thead>
            <tr>
                <th>Descrição</th>
                <th style="text-align: center;">UN</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Unitário</th>
                <th style="text-align: right;">Total</th>
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
    
    <div style="clear: both;"></div>
    
    <div class="terms">
        <h4>Considerações</h4>
        <?php if (!empty($company['detalhes_adicionais'])): ?>
            <?= $company['detalhes_adicionais'] ?>
        <?php else: ?>
            <p>Validade da proposta: 15 dias.</p>
        <?php endif; ?>
    </div>
</body>
</html>
