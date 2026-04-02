-- ============================================================
-- MIGRATION: Documentação de Empresa (Upload)
-- Gerador de Orçamentos
-- Data: 2026-04-02
-- ============================================================

ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS doc_path VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS doc_original_name VARCHAR(255) NULL;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
