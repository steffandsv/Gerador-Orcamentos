-- Migration: card_activities + email_queue tables
-- For Activity tab and email dispatch queue

CREATE TABLE IF NOT EXISTS card_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  orcamento_id INT NOT NULL,
  user_id INT,
  type VARCHAR(30) NOT NULL,
  parent_activity_id INT,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
  INDEX idx_card_activities_orcamento (orcamento_id),
  INDEX idx_card_activities_parent (parent_activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_queue (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  orcamento_id INT NOT NULL,
  company_index INT NOT NULL,
  activity_id INT,
  recipient_email VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  scheduled_at DATETIME NOT NULL,
  sent_at DATETIME,
  error TEXT,
  pdf_data LONGTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
  INDEX idx_email_queue_status (status, scheduled_at),
  INDEX idx_email_queue_orcamento (orcamento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
