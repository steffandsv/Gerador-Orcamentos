<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Orçamento - <?= htmlspecialchars($company['nome']) ?></title>
    <style>
        body {
            font-family: Helvetica, Arial, sans-serif;
            color: #222;
            background: #fff;
            padding: 30px;
        }
        @page { size: A4; margin: 1.5cm; }
        
        .top-bar {
            background: #222;
            color: #fff;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .top-bar h1 {
            margin: 0;
            font-size: 22px;
            letter-spacing: 1px;
        }
        
        .client-box {
            border: 3px solid #222;
            padding: 20px;
            margin: 20px 0;
            display: flex;
            justify-content: space-between;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background: #222;
            color: #fff;
            text-align: left;
            padding: 10px;
            text-transform: uppercase;
            font-size: 13px;
        }
        td {
            padding: 10px;
            border-bottom: 2px solid #ddd;
        }
        
        .total-box {
            float: right;
            background: #222;
            color: #fff;
            padding: 15px 30px;
            margin-top: 20px;
            font-size: 20px;
            font-weight: bold;
        }
        
        .clear { clear: both; }
        
        .notes {
            margin-top: 40px;
            border-top: 1px dotted #999;
            padding-top: 10px;
            font-size: 12px;
        }
        .rich-text {
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="top-bar">
        <h1><?= htmlspecialchars($company['nome']) ?></h1>
        <div>ORÇAMENTO #<?= $quote['id'] ?></div>
    </div>

    <div class="client-box">
        <div>
            <strong>EMISSOR:</strong><br>
            <?= htmlspecialchars($company['nome']) ?><br>
            <?= htmlspecialchars($company['endereco']) ?><br>
            CNPJ: <?= htmlspecialchars($company['documento']) ?>
        </div>
        <div style="text-align:right;">
            <strong>CONTATO:</strong><br>
            <?= htmlspecialchars($company['email']) ?><br>
            <?= htmlspecialchars($company['telefone']) ?>
        </div>
    </div>

    <h3>PROPOSTA COMERCIAL: <?= htmlspecialchars($quote['titulo']) ?></h3>
    <p>Data: <?= date('d/m/Y', strtotime($quote['data_criacao'])) ?></p>

    <table>
        <thead>
            <tr>
                <th>Descrição do Item</th>
                <th style="width: 50px;">UN</th>
                <th style="width: 80px;">Qtd</th>
                <th style="width: 120px;">V. Unit.</th>
                <th style="width: 120px;">Subtotal</th>
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
                <td><?= htmlspecialchars($item['unidade'] ?? 'UN') ?></td>
                <td><?= number_format($item['quantidade'], 2, ',', '.') ?></td>
                <td>R$ <?= number_format($item['final_price'], 2, ',', '.') ?></td>
                <td>R$ <?= number_format($item['total_price'], 2, ',', '.') ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <div class="total-box">
        TOTAL: R$ <?= number_format($grandTotal, 2, ',', '.') ?>
    </div>
    
    <div class="clear"></div>

    <div class="notes">
        <?php if (!empty($company['detalhes_adicionais'])): ?>
            <div class="rich-text">
                <?= $company['detalhes_adicionais'] ?>
            </div>
        <?php else: ?>
            <p>Condições de Pagamento: A combinar.</p>
            <p>Validade da Proposta: 7 dias úteis.</p>
        <?php endif; ?>
    </div>
</body>
</html>
