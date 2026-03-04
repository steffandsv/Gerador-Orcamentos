-- Migration V2: Nova tabela rica de itens de orçamento
-- Adiciona colunas para código, valor de compra/venda, auto-preço, marca/modelo e link

ALTER TABLE itens_orcamento ADD COLUMN IF NOT EXISTS codigo INT NULL;
ALTER TABLE itens_orcamento ADD COLUMN IF NOT EXISTS valor_compra DECIMAL(10,2) NULL;
ALTER TABLE itens_orcamento ADD COLUMN IF NOT EXISTS valor_venda DECIMAL(10,2) NULL;
ALTER TABLE itens_orcamento ADD COLUMN IF NOT EXISTS auto_preco TINYINT DEFAULT 0;
ALTER TABLE itens_orcamento ADD COLUMN IF NOT EXISTS marca_modelo VARCHAR(255) NULL;
ALTER TABLE itens_orcamento ADD COLUMN IF NOT EXISTS link_compra VARCHAR(500) NULL;

-- Migrar dados da coluna antiga para a nova
UPDATE itens_orcamento SET valor_compra = preco_unitario WHERE valor_compra IS NULL AND preco_unitario IS NOT NULL;

-- Remover colunas antigas
ALTER TABLE itens_orcamento DROP COLUMN IF EXISTS preco_unitario;
ALTER TABLE itens_orcamento DROP COLUMN IF EXISTS unidade;
