<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            background: #fff;
            padding: 40px;
            font-size: 14px;
        }
        @page { size: A4; margin: 2cm; }
        .header {
            border-bottom: 2px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
        }
        .company-info h1 {
            color: #0066cc;
            margin: 0;
            font-size: 24px;
            text-transform: uppercase;
        }
        .meta {
            text-align: right;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        th {
            background: #f0f8ff;
            color: #0066cc;
            font-weight: bold;
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ccc;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        .total-row td {
            font-size: 18px;
            font-weight: bold;
            color: #000;
            background: #f9f9f9;
        }
        .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 12px;
            color: #888;
            border-top: 1px solid #eee;
            padding-top: 20px;
        }
        .rich-text {
            margin-top: 40px;
            text-align: left;
            font-size: 13px;
            color: #444;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h1><?= htmlspecialchars($company['nome']) ?></h1>
            <p><?= htmlspecialchars($company['endereco']) ?><br>
               CNPJ: <?= htmlspecialchars($company['documento']) ?><br>
                Tel: <?= htmlspecialchars($company['telefone']) ?> 
            </p>
        </div>
        <div class="meta">
            <p><strong>Orçamento #<?= $quote['id'] ?></strong><br>
               Data: <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?></p>
            <?php if (!empty($quote['solicitante_nome'])): ?>
                <p style="margin-top:10px; border-top:1px solid #ccc; padding-top:5px;">
                    <strong>SOLICITANTE:</strong><br>
                    <?= htmlspecialchars($quote['solicitante_nome']) ?><br>
                    CNPJ: <?= htmlspecialchars($quote['solicitante_cnpj']) ?>
                </p>
            <?php endif; ?>
        </div>
    </div>

    <h2><?= htmlspecialchars($quote['titulo']) ?></h2>

    <table>
        <thead>
            <tr>
                <th>Descrição</th>
                <th style="text-align:center; width: 50px;">UN</th>
                <th style="text-align:center; width: 80px;">Qtd</th>
                <th style="text-align:right; width: 130px;">Valor Unit.</th>
                <th style="text-align:right; width: 130px;">Total</th>
            </tr>
        </thead>
        <tbody>
            <?php 
            $grandTotal = 0;
            foreach ($items as $item): 
                $grandTotal += $item['total_price'];
            ?>
            <tr>
                <td><?= htmlspecialchars($item['descricao']) ?></td>
                <td style="text-align:center;"><?= htmlspecialchars($item['unidade'] ?? 'UN') ?></td>
                <td style="text-align:center;"><?= number_format($item['quantidade'], 2, ',', '.') ?></td>
                <td style="text-align:right;">R$ <?= number_format($item['final_price'], 2, ',', '.') ?></td>
                <td style="text-align:right;">R$ <?= number_format($item['total_price'], 2, ',', '.') ?></td>
            </tr>
            <?php endforeach; ?>
            <tr class="total-row">
                <td colspan="3" style="text-align:right;">TOTAL GERAL</td>
                <td style="text-align:right;">R$ <?= number_format($grandTotal, 2, ',', '.') ?></td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <?php if (!empty($company['detalhes_adicionais'])): ?>
            <div class="rich-text">
                <?= $company['detalhes_adicionais'] ?>
            </div>
        <?php else: ?>
            <p>Este orçamento é válido por 15 dias.</p>
        <?php endif; ?>
    </div>
</body>
</html>
