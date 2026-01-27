<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body { font-family: 'Roboto', sans-serif; padding: 40px; color: #444; }
        @page { size: A4; margin: 2cm; }
        .logo-area { border-bottom: 2px solid #e67e22; padding-bottom: 20px; margin-bottom: 40px; }
        .logo-area h1 { color: #e67e22; font-size: 36px; margin: 0; }
        
        .grid { display: flex; margin-bottom: 40px; }
        .col { flex: 1; }
        
        table { width: 100%; border-collapse: collapse; }
        th { border-bottom: 2px solid #e67e22; color: #e67e22; text-align: left; padding: 10px; }
        td { padding: 15px 10px; border-bottom: 1px solid #eee; }
        
        .total-row { background: #e67e22; color: #fff; font-size: 18px; font-weight: bold; }
        .total-row td { border: none; }
        
        .footer { margin-top: 50px; font-size: 12px; color: #999; text-align: center; }
        .rich-text { margin-top: 40px; padding: 20px; background: #fff8f0; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="logo-area">
        <h1><?= htmlspecialchars($company['nome']) ?></h1>
        <span>Soluções Inteligentes</span>
    </div>
    
    <div class="grid">
        <div class="col">
            <strong>EMPRESA</strong><br>
            <?= htmlspecialchars($company['endereco']) ?><br>
            <?= htmlspecialchars($company['telefone']) ?><br>
            <?= htmlspecialchars($company['email']) ?>
        </div>
        <div class="col" style="text-align: right;">
            <strong>ORÇAMENTO</strong><br>
            #<?= $quote['id'] ?><br>
            <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?>
        </div>
    </div>

    <?php if (!empty($quote['solicitante_nome'])): ?>
    <div class="grid" style="margin-bottom: 20px; border-bottom: 1px dashed #e67e22; padding-bottom: 20px;">
        <div class="col">
            <strong>SOLICITANTE</strong><br>
            <?= htmlspecialchars($quote['solicitante_nome']) ?><br>
            <?= htmlspecialchars($quote['solicitante_cnpj']) ?>
        </div>
    </div>
    <?php endif; ?>
    
    <h3><?= htmlspecialchars($quote['titulo']) ?></h3>
    
    <table>
        <thead>
            <tr>
                <th>Descrição</th>
                <th style="width: 50px;">UN</th>
                <th>Qtd</th>
                <th>Unitário</th>
                <th style="text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
            <?php $grandTotal = 0; foreach ($items as $item): $grandTotal += $item['total_price']; ?>
            <tr>
                <td><?= htmlspecialchars($item['descricao']) ?></td>
                <td><?= htmlspecialchars($item['unidade'] ?? 'UN') ?></td>
                <td><?= number_format($item['quantidade'], 2, ',', '.') ?></td>
                <td>R$ <?= number_format($item['final_price'], 2, ',', '.') ?></td>
                <td style="text-align: right;">R$ <?= number_format($item['total_price'], 2, ',', '.') ?></td>
            </tr>
            <?php endforeach; ?>
            <tr class="total-row">
                <td colspan="3" style="text-align: right; padding-right: 20px;">TOTAL</td>
                <td style="text-align: right;">R$ <?= number_format($grandTotal, 2, ',', '.') ?></td>
            </tr>
        </tbody>
    </table>
    
    <div class="rich-text">
        <?php if (!empty($company['detalhes_adicionais'])): ?>
            <?= $company['detalhes_adicionais'] ?>
        <?php else: ?>
            <p>Orçamento sujeito a aprovação.</p>
        <?php endif; ?>
    </div>
    
    <div class="footer">
        Gerado digitalmente em <?= date('d/m/Y H:i') ?>
    </div>
</body>
</html>
