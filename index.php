<?php
require_once 'config.php';

$page = $_GET['page'] ?? 'home';
$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Global Router Logic
if ($page === 'print') {
    $quote_id = $_GET['id'] ?? 0;
    $comp_idx = $_GET['company_index'] ?? 1; // 1, 2 or 3

    // Fetch Quote
    $stmt = $pdo->prepare("SELECT * FROM orcamentos WHERE id = ?");
    $stmt->execute([$quote_id]);
    $quote = $stmt->fetch();

    if (!$quote) { die("Orçamento não encontrado."); }

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

    // Display ID Offset Logic
    $offset = 0;
    if ($comp_idx == 1) $offset = 50;
    elseif ($comp_idx == 2) $offset = 150;
    elseif ($comp_idx == 3) $offset = 280;
    
    $quote['id'] = $quote['id'] + $offset;

    // Select Layout based on Company Index (1, 2, 3)
    $tpl_field = 'template' . $comp_idx . '_id';
    $template_id = $quote[$tpl_field] ?? $comp_idx;
    if (!$template_id) { $template_id = $comp_idx; }

    $layout_file = 'views/print_layout_' . $template_id . '.php';
    
    if (file_exists($layout_file)) {
        require_once $layout_file;
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
    
    // SMTP Fields
    $smtp_host = $_POST['smtp_host'] ?? '';
    $smtp_port = $_POST['smtp_port'] ?? '';
    $smtp_user = $_POST['smtp_user'] ?? '';
    $smtp_pass = $_POST['smtp_pass'] ?? '';
    $smtp_secure = $_POST['smtp_secure'] ?? '';

    $id = $_POST['id'] ?? null;

    if ($id) {
        $stmt = $pdo->prepare("UPDATE empresas SET nome=?, documento=?, endereco=?, telefone=?, email=?, detalhes_adicionais=?, smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?, smtp_secure=? WHERE id=?");
        $stmt->execute([$nome, $documento, $endereco, $telefone, $email, $detalhes, $smtp_host, $smtp_port, $smtp_user, $smtp_pass, $smtp_secure, $id]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO empresas (nome, documento, endereco, telefone, email, detalhes_adicionais, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$nome, $documento, $endereco, $telefone, $email, $detalhes, $smtp_host, $smtp_port, $smtp_user, $smtp_pass, $smtp_secure]);
    }
    header("Location: index.php?page=empresas");
    exit;

} elseif ($action === 'delete_company') {
    $id = $_POST['id'];
    $stmt = $pdo->prepare("DELETE FROM empresas WHERE id=?");
    $stmt->execute([$id]);
    header("Location: index.php?page=empresas");
    exit;
    

} elseif ($action === 'search_solicitante') {
    $term = $_GET['term'] ?? '';
    if (strlen($term) < 2) {
        echo json_encode([]);
        exit;
    }
    
    // Search with wildcard, distinct
    $stmt = $pdo->prepare("SELECT DISTINCT solicitante_nome, solicitante_cnpj FROM orcamentos WHERE solicitante_nome LIKE ? LIMIT 10");
    $stmt->execute(['%' . $term . '%']);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    header('Content-Type: application/json');
    echo json_encode($results);
    exit;

} elseif ($action === 'delete_quote') {
    $id = $_POST['id'];
    
    // Deleting items handled by constraint usually, but let's be safe or assume ON DELETE CASCADE
    // If no cascade, we should delete items first. Assuming simplified:
    $stmt = $pdo->prepare("DELETE FROM itens_orcamento WHERE orcamento_id=?");
    $stmt->execute([$id]);
    
    $stmt = $pdo->prepare("DELETE FROM orcamentos WHERE id=?");
    $stmt->execute([$id]);
    
    header("Location: index.php?page=orcamentos");
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

        $solicitante_nome = $_POST['solicitante_nome'] ?? '';
        $solicitante_cnpj = $_POST['solicitante_cnpj'] ?? '';
        $quote_id = $_POST['quote_id'] ?? null;

        if ($quote_id) {
            // Update Existing
            $stmt = $pdo->prepare("UPDATE orcamentos SET titulo=?, empresa1_id=?, empresa2_id=?, empresa3_id=?, variacao_maxima=?, template1_id=?, template2_id=?, template3_id=?, solicitante_nome=?, solicitante_cnpj=? WHERE id=?");
            $stmt->execute([$titulo, $emp1, $emp2, $emp3, $variacao, $tpl1, $tpl2, $tpl3, $solicitante_nome, $solicitante_cnpj, $quote_id]);
            
            // Re-create items (simplest way for now)
            $stmt = $pdo->prepare("DELETE FROM itens_orcamento WHERE orcamento_id=?");
            $stmt->execute([$quote_id]);
            $orcamento_id = $quote_id;

        } else {
            // Create New
            $stmt = $pdo->prepare("INSERT INTO orcamentos (titulo, empresa1_id, empresa2_id, empresa3_id, variacao_maxima, template1_id, template2_id, template3_id, solicitante_nome, solicitante_cnpj) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$titulo, $emp1, $emp2, $emp3, $variacao, $tpl1, $tpl2, $tpl3, $solicitante_nome, $solicitante_cnpj]);
            $orcamento_id = $pdo->lastInsertId();
        }

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

// SMTP Actions
if ($action === 'test_smtp') {
    require 'api/test_smtp.php';
    exit;

} elseif ($action === 'send_budget') {
    require 'api/send_budget.php';
    exit;
}

// View Rendering
if ($page !== 'print') {
    require_once 'views/layout_header.php';
}

switch ($page) {
    case 'empresas':
        // Load companies from DB
        $stmt = $pdo->query("SELECT * FROM empresas ORDER BY nome ASC");
        $empresas = $stmt->fetchAll();
        require_once 'views/company_list.php'; // Will create next
        break;
        
    case 'empresa_form':
        $id = $_GET['id'] ?? null;
        $empresa = null;
        if ($id) {
            $stmt = $pdo->prepare("SELECT * FROM empresas WHERE id = ?");
            $stmt->execute([$id]);
            $empresa = $stmt->fetch();
        }
        require_once 'views/company_form.php'; // Will create next
        break;

    case 'orcamentos':
        // Load quotes
        $stmt = $pdo->query("SELECT o.*, e.nome as empresa_vencedora 
                             FROM orcamentos o 
                             LEFT JOIN empresas e ON o.empresa1_id = e.id 
                             ORDER BY o.data_criacao DESC");
        $orcamentos = $stmt->fetchAll();
        require_once 'views/quote_list.php'; // Will create later
        break;
        
    case 'orcamento_form':
        // Load companies for select
        $stmt = $pdo->query("SELECT * FROM empresas ORDER BY nome ASC");
        $empresas = $stmt->fetchAll();
        
        // Autocomplete Data: Unique Solicitantes
        $stmt = $pdo->query("SELECT DISTINCT solicitante_nome, solicitante_cnpj FROM orcamentos WHERE solicitante_nome IS NOT NULL AND solicitante_nome != ''");
        $solicitantes_db = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Edit Mode Data
        $quote_edit = null;
        $items_edit = [];
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("SELECT * FROM orcamentos WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            $quote_edit = $stmt->fetch();
            
            if ($quote_edit) {
               $stmt = $pdo->prepare("SELECT * FROM itens_orcamento WHERE orcamento_id = ?");
               $stmt->execute([$_GET['id']]);
               $items_edit = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
        }

        require_once 'views/quote_form.php'; // Will create later
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
