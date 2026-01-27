<?php
// Standalone Template Previewer
// Does not require database connection.

$template_id = $_GET['template_id'] ?? 1;

// Mock Quote Data
$quote = [
    'id' => 12345,
    'titulo' => 'Orçamento de Demonstração',
    'data_criacao' => date('Y-m-d H:i:s'),
    'variacao_maxima' => 10
];

// Mock Company Data (Generic)
$company = [
    'nome' => 'Empresa Exemplo Ltda',
    'documento' => '00.000.000/0001-99',
    'endereco' => 'Av. das Nações, 1000 - Centro, São Paulo/SP',
    'telefone' => '(11) 9999-9999',
    'email' => 'contato@exemplo.com.br',
    'detalhes_adicionais' => '<p>Orçamento válido por 15 dias. Pagamento em até 30 dias.</p>'
];

// Mock Items Data
$items = [
    [
        'id' => 1,
        'descricao' => 'Caneta Esferográfica Azul',
        'unidade' => 'UN',
        'quantidade' => 100,
        'preco_unitario' => 1.50,
        'final_price' => 1.50,
        'total_price' => 150.00
    ],
    [
        'id' => 2,
        'descricao' => 'Papel Sulfite A4 (Resma)',
        'unidade' => 'CX',
        'quantidade' => 10,
        'preco_unitario' => 25.00,
        'final_price' => 25.00,
        'total_price' => 250.00
    ],
    [
        'id' => 3,
        'descricao' => 'Cadeira de Escritório',
        'unidade' => 'PC',
        'quantidade' => 5,
        'preco_unitario' => 450.00,
        'final_price' => 450.00,
        'total_price' => 2250.00
    ]
];

$layout_file = 'views/print_layout_' . $template_id . '.php';

if (file_exists($layout_file)) {
    // Wrap in a scaler for better preview if needed, or just raw
    // For raw preview inside iframe:
    require $layout_file;
} else {
    echo "Layout #$template_id não encontrado.";
}
