<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body {
            font-family: 'Times New Roman', Times, serif;
            color: #000;
            background: #fff;
            padding: 40px;
            font-size: 15px;
        }
        @page { size: A4; margin: 2.5cm; }
        .header {
            text-align: center;
            border-bottom: 4px double #000;
            padding-bottom: 20px;
            margin-bottom: 40px;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            letter-spacing: 2px;
        }
        .info-block {
            margin-bottom: 30px;
            line-height: 1.8;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
            margin-bottom: 30px;
        }
        th, td {
            border: 1px solid #000;
            padding: 8px 12px;
        }
        th {
            background: #eee;
            text-transform: uppercase;
            font-size: 12px;
        }
        .total-row td {
            font-weight: bold;
            background: #eee;
        }
        .signatures {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
        }
        .sig-line {
            width: 40%;
            border-top: 1px solid #000;
            text-align: center;
            padding-top: 5px;
        }
        .rich-text {
            margin-top: 30px;
            border-top: 1px dashed #000;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1><?= htmlspecialchars($company['nome']) ?></h1>
        <p><?= htmlspecialchars($company['endereco']) ?> &bull; <?= htmlspecialchars($company['telefone']) ?></p>
        <p>CNPJ: <?= htmlspecialchars($company['documento']) ?> &bull; <?= htmlspecialchars($company['email']) ?></p>
    </div>

    <div class="info-block">
        <strong>Referência:</strong> <?= htmlspecialchars($quote['titulo']) ?><br>
        <strong>Número:</strong> <?= sprintf('%06d', $quote['id']) ?>/<?= date('Y') ?><br>
        <strong>Data:</strong> <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?><br>
        <?php if (!empty($quote['solicitante_nome'])): ?>
            <div style="margin-top:10px; border-top:1px dashed #000; padding-top:5px;">
                <strong>SOLICITANTE:</strong> <?= htmlspecialchars($quote['solicitante_nome']) ?><br>
                <strong>CNPJ:</strong> <?= htmlspecialchars($quote['solicitante_cnpj']) ?>
            </div>
        <?php endif; ?>
    </div>

    <table>
        <thead>
            <tr>
                <th>Item / Descrição</th>
                <th style="text-align:center; width: 50px;">UN</th>
                <th style="text-align:center; width: 80px;">Quant.</th>
                <th style="text-align:right; width: 110px;">Unitário (R$)</th>
                <th style="text-align:right; width: 110px;">Total (R$)</th>
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
                <td style="text-align:right;"><?= number_format($item['final_price'], 2, ',', '.') ?></td>
                <td style="text-align:right;"><?= number_format($item['total_price'], 2, ',', '.') ?></td>
            </tr>
            <?php endforeach; ?>
            <tr class="total-row">
                <td colspan="3" style="text-align:right;">VALOR TOTAL</td>
                <td style="text-align:right;"><?= number_format($grandTotal, 2, ',', '.') ?></td>
            </tr>
        </tbody>
    </table>

    <?php if (!empty($company['detalhes_adicionais'])): ?>
        <div class="rich-text">
            <?= $company['detalhes_adicionais'] ?>
        </div>
    <?php endif; ?>

    <div class="signatures">
        <div class="sig-line">Representante Comercial</div>
        <div class="sig-line">Cliente</div>
    </div>
</body>
</html>
