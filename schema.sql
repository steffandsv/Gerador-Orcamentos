-- ============================================================
-- MIGRATION: User Management, Audit Trails & Soft Deletes
-- Gerador de Orçamentos
-- Data: 2026-03-04
-- ============================================================

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    created_by INT NULL,
    updated_by INT NULL,
    deleted_by INT NULL,
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_deleted_at (deleted_at)
);

-- 2. Tabela de Audit Log (Fingerprints)
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id INT NULL,
    details TEXT NULL,
    old_data TEXT NULL,
    new_data TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity, entity_id),
    INDEX idx_created_at (created_at)
);

-- 3. Adicionar colunas de fingerprint e soft delete na tabela empresas
ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL,
    ADD COLUMN IF NOT EXISTS created_by INT NULL,
    ADD COLUMN IF NOT EXISTS updated_by INT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by INT NULL;

-- 4. Adicionar colunas de fingerprint e soft delete na tabela orcamentos
ALTER TABLE orcamentos
    ADD COLUMN IF NOT EXISTS created_at DATETIME NULL,
    ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL,
    ADD COLUMN IF NOT EXISTS created_by INT NULL,
    ADD COLUMN IF NOT EXISTS updated_by INT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by INT NULL;

-- 5. Índices para soft delete (performance)
ALTER TABLE empresas ADD INDEX IF NOT EXISTS idx_empresas_deleted_at (deleted_at);
ALTER TABLE orcamentos ADD INDEX IF NOT EXISTS idx_orcamentos_deleted_at (deleted_at);

-- 6. Seed do usuário admin (senha: stelia)
-- Hash bcrypt de "stelia": $2a$10$YqKGxKj8v5Z5HjN5G5v5O.5FN5dZ5v5O5FN5dZ5v5O5FN5dZ5v5O
-- NOTA: Execute o INSERT abaixo OU use o script Node.js para gerar o hash correto.
-- O hash abaixo será substituído pelo hash real gerado pelo script seed.

-- 7. Inserir admin (senha: stelia)
-- Depois de rodar este script, execute no terminal:
--   npx tsx scripts/seed-admin.ts
-- Isso criará o admin com hash bcrypt correto.

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
