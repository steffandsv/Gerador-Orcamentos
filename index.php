<?php
require 'config.php';

$page = $_GET['page'] ?? 'home';
$action = $_POST['action'] ?? '';

// Global Router Logic
if ($page === 'print') {
    $quote_id = $_GET['id'] ?? 0;
    $comp_idx = $_GET['company_index'] ?? 1; // 1, 2 or 3

    // Fetch Quote
    $stmt = $pdo->prepare("SELECT * FROM orcamentos WHERE id = ?");
    $stmt->execute([$quote_id]);
    $quote = $stmt->fetch();

    if (!$quote) die("Orçamento não encontrado.");

    // Determine Company ID
    $company_field = 'empresa' . $comp_idx . '_id';
    $company_id = $quote[$company_field] ?? null;

    // Fetch Company
    $stmt = $pdo->prepare("SELECT * FROM empresas WHERE id = ?");
    $stmt->execute([$company_id]);
    $company = $stmt->fetch();

    if (!$company) die("Empresa não encontrada.");

    // Fetch Items
    $stmt = $pdo->prepare("SELECT * FROM itens_orcamento WHERE orcamento_id = ?");
    $stmt->execute([$quote_id]);
    $items = $stmt->fetchAll();

    // Calculate Prices
    foreach ($items as &$item) {
        if ($comp_idx == 1) {
            // Winner - Original Prices
            $item['final_price'] = $item['preco_unitario'];
        } else {
            // Loser - Random Increase
            // Deterministic Seed: QuoteID + CompanyIndex + ItemID
            $seed = (int)$quote_id . (int)$comp_idx . (int)$item['id'];
            mt_srand($seed);
            
            // Random percent between 1% and Max% (step 0.1%)
            $max_var = $quote['variacao_maxima'];
            $random_percent = mt_rand(10, $max_var * 10) / 10; // e.g., 1.0 to 15.0
            
            $item['final_price'] = $item['preco_unitario'] * (1 + ($random_percent / 100));
        }
        $item['total_price'] = $item['final_price'] * $item['quantidade'];
    }
    unset($item); // Break reference

    // Select Layout based on Company Index (1, 2, 3)
    $tpl_field = 'template' . $comp_idx . '_id';
    $template_id = $quote[$tpl_field] ?? $comp_idx;
    if (!$template_id) $template_id = $comp_idx;

    $layout_file = 'views/print_layout_' . $template_id . '.php';
    
    if (file_exists($layout_file)) {
        require $layout_file;
    } else {
        echo "Layout file not found: $layout_file";
    }
    exit;
}

// Controller Logic Handlers (to be expanded)
if ($action === 'save_company') {
    $nome = $_POST['nome'];
    $documento = $_POST['documento'];
    $endereco = $_POST['endereco'];
    $telefone = $_POST['telefone'];
    $email = $_POST['email'];
    $detalhes = $_POST['detalhes_adicionais'] ?? '';
    $id = $_POST['id'] ?? null;

    if ($id) {
        $stmt = $pdo->prepare("UPDATE empresas SET nome=?, documento=?, endereco=?, telefone=?, email=?, detalhes_adicionais=? WHERE id=?");
        $stmt->execute([$nome, $documento, $endereco, $telefone, $email, $detalhes, $id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO empresas (nome, documento, endereco, telefone, email, detalhes_adicionais) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$nome, $documento, $endereco, $telefone, $email, $detalhes]);
    }
    header("Location: index.php?page=empresas");
    exit;

} elseif ($action === 'delete_company') {
    $id = $_POST['id'];
    $stmt = $pdo->prepare("DELETE FROM empresas WHERE id=?");
    $stmt->execute([$id]);
    header("Location: index.php?page=empresas");
    exit;

} elseif ($action === 'save_quote') {
    $titulo = $_POST['titulo'];
    $emp1 = $_POST['empresa1_id'];
    $emp2 = $_POST['empresa2_id'];
    $emp3 = $_POST['empresa3_id'];
    $tpl1 = $_POST['template1_id'] ?? 1;
    $tpl2 = $_POST['template2_id'] ?? 2;
    $tpl3 = $_POST['template3_id'] ?? 3;
    $variacao = $_POST['variacao_maxima'];
    $items = $_POST['items'] ?? [];

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("INSERT INTO orcamentos (titulo, empresa1_id, empresa2_id, empresa3_id, variacao_maxima, template1_id, template2_id, template3_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$titulo, $emp1, $emp2, $emp3, $variacao, $tpl1, $tpl2, $tpl3]);
        $orcamento_id = $pdo->lastInsertId();

        $stmtItem = $pdo->prepare("INSERT INTO itens_orcamento (orcamento_id, descricao, unidade, quantidade, preco_unitario) VALUES (?, ?, ?, ?, ?)");
        
        foreach ($items as $item) {
            if (!empty($item['descricao'])) {
                $unidade = !empty($item['unidade']) ? $item['unidade'] : 'UN';
                $stmtItem->execute([$orcamento_id, $item['descricao'], $unidade, $item['quantidade'], $item['preco_unitario']]);
            }
        }

        $pdo->commit();
        header("Location: index.php?page=orcamentos");
        exit;

    } catch (Exception $e) {
        $pdo->rollBack();
        die("Erro ao salvar orçamento: " . $e->getMessage());
    }
}

// View Rendering
if ($page !== 'print') {
    require 'views/layout_header.php';
}

switch ($page) {
    case 'empresas':
        // Load companies from DB
        $stmt = $pdo->query("SELECT * FROM empresas ORDER BY nome ASC");
        $empresas = $stmt->fetchAll();
        require 'views/company_list.php'; // Will create next
        break;
        
    case 'empresa_form':
        $id = $_GET['id'] ?? null;
        $empresa = null;
        if ($id) {
            $stmt = $pdo->prepare("SELECT * FROM empresas WHERE id = ?");
            $stmt->execute([$id]);
            $empresa = $stmt->fetch();
        }
        require 'views/company_form.php'; // Will create next
        break;

    case 'orcamentos':
        // Load quotes
        $stmt = $pdo->query("SELECT o.*, e.nome as empresa_vencedora 
                             FROM orcamentos o 
                             LEFT JOIN empresas e ON o.empresa1_id = e.id 
                             ORDER BY o.data_criacao DESC");
        $orcamentos = $stmt->fetchAll();
        require 'views/quote_list.php'; // Will create later
        break;
        
    case 'orcamento_form':
        // Load companies for select
        $stmt = $pdo->query("SELECT * FROM empresas ORDER BY nome ASC");
        $empresas = $stmt->fetchAll();
        require 'views/quote_form.php'; // Will create later
        break;

    default:
        echo "<h2>Bem-vindo ao Gerador de Orçamentos</h2>";
        echo "<p>Selecione uma opção no menu acima.</p>";
        echo "<a href='index.php?page=orcamentos' class='btn'>Ver Orçamentos</a>";
        break;
}

if ($page !== 'print') {
    require 'views/layout_footer.php';
}
