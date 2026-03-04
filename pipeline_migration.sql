-- ============================================================
-- MIGRATION: Pipeline Board System
-- Gerador de Orçamentos
-- Data: 2026-03-04
-- ============================================================

-- 1. Novas colunas na tabela orcamentos
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS stage VARCHAR(20) NOT NULL DEFAULT 'inbox',
  ADD COLUMN IF NOT EXISTS deadline DATETIME NULL,
  ADD COLUMN IF NOT EXISTS assigned_to INT NULL,
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

ALTER TABLE orcamentos ADD INDEX IF NOT EXISTS idx_stage (stage);
ALTER TABLE orcamentos ADD INDEX IF NOT EXISTS idx_assigned_to (assigned_to);
ALTER TABLE orcamentos ADD INDEX IF NOT EXISTS idx_deadline (deadline);

-- 2. Tabela de Labels
CREATE TABLE IF NOT EXISTS labels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Junction table: orcamento <-> label
CREATE TABLE IF NOT EXISTS orcamento_labels (
  orcamento_id INT NOT NULL,
  label_id INT NOT NULL,
  PRIMARY KEY (orcamento_id, label_id),
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

-- 4. Tabela de Comentários
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orcamento_id INT NOT NULL,
  user_id INT NOT NULL,
  parent_id INT NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES usuarios(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL,
  INDEX idx_comment_orcamento (orcamento_id),
  INDEX idx_comment_created (created_at)
);

-- 5. Seeds de labels padrão
INSERT INTO labels (name, color) VALUES
  ('Urgente', '#ef4444'),
  ('Alta Prioridade', '#f59e0b'),
  ('Normal', '#3b82f6'),
  ('Baixa', '#94a3b8'),
  ('Pregão', '#10b981'),
  ('Dispensa', '#8b5cf6');

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
