CREATE TABLE IF NOT EXISTS empresas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    documento VARCHAR(50),
    endereco TEXT,
    telefone VARCHAR(50),
    email VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS orcamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    empresa1_id INT NOT NULL,
    empresa2_id INT NOT NULL,
    empresa3_id INT NOT NULL,
    variacao_maxima DECIMAL(5,2) NOT NULL,
    template1_id INT DEFAULT 1,
    template2_id INT DEFAULT 2,
    template3_id INT DEFAULT 3,
    FOREIGN KEY (empresa1_id) REFERENCES empresas(id),
    FOREIGN KEY (empresa2_id) REFERENCES empresas(id),
    FOREIGN KEY (empresa3_id) REFERENCES empresas(id)
);

CREATE TABLE IF NOT EXISTS itens_orcamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orcamento_id INT NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    unidade VARCHAR(20) DEFAULT 'UN',
    quantidade DECIMAL(10,2) NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE
);
