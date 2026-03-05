-- Make empresa IDs and variacao_maxima nullable for pipeline cards
-- These fields are only required when generating the actual orçamento PDF

ALTER TABLE `orcamentos` MODIFY COLUMN `empresa1_id` INT NULL;
ALTER TABLE `orcamentos` MODIFY COLUMN `empresa2_id` INT NULL;
ALTER TABLE `orcamentos` MODIFY COLUMN `empresa3_id` INT NULL;
ALTER TABLE `orcamentos` MODIFY COLUMN `variacao_maxima` DECIMAL(5,2) NULL;
