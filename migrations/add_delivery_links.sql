-- Migration: Add delivery method and links to orcamentos
ALTER TABLE orcamentos ADD COLUMN delivery_type VARCHAR(10) DEFAULT NULL AFTER position;
ALTER TABLE orcamentos ADD COLUMN delivery_target VARCHAR(500) DEFAULT NULL AFTER delivery_type;
ALTER TABLE orcamentos ADD COLUMN links JSON DEFAULT NULL AFTER delivery_target;
