<?php
require_once 'config.php';

echo "<h2>Atualizando o Banco de Dados...</h2>";

try {
    // 1. Add solicitante columns
    $sql1 = "ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS solicitante_nome VARCHAR(255) DEFAULT NULL";
    $pdo->exec($sql1);
    echo "<p>Coluna <strong>solicitante_nome</strong> verificada/criada.</p>";

    $sql2 = "ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS solicitante_cnpj VARCHAR(20) DEFAULT NULL";
    $pdo->exec($sql2);
    echo "<p>Coluna <strong>solicitante_cnpj</strong> verificada/criada.</p>";

    // 2. Add template columns if missing (just in case)
    $sql3 = "ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS template1_id INT DEFAULT 1";
    $pdo->exec($sql3);
    $sql4 = "ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS template2_id INT DEFAULT 2";
    $pdo->exec($sql4);
    $sql5 = "ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS template3_id INT DEFAULT 3";
    $pdo->exec($sql5);
    echo "<p>Colunas de <strong>template</strong> verificadas.</p>";

    echo "<h3 style='color:green'>Atualização concluída com sucesso!</h3>";
    echo "<a href='index.php'>Voltar para o Sistema</a>";

} catch (PDOException $e) {
    echo "<h3 style='color:red'>Erro ao atualizar:</h3>";
    echo "<pre>" . $e->getMessage() . "</pre>";
}
