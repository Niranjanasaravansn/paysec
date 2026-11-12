CREATE DATABASE IF NOT EXISTS paysec CHARACTER SET utf8mb4;
USE paysec;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  notify_email TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE merchants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  merchant_code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60),
  trust_score TINYINT UNSIGNED NOT NULL DEFAULT 50,
  status ENUM('TRUSTED','UNVERIFIED','BLOCKED') NOT NULL DEFAULT 'UNVERIFIED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_merchant_status (status)
) ENGINE=InnoDB;

CREATE TABLE user_spending_limits (
  user_id INT PRIMARY KEY,
  max_transaction DECIMAL(12,2) NOT NULL DEFAULT 50000,
  daily_limit DECIMAL(12,2) NOT NULL DEFAULT 100000,
  monthly_limit DECIMAL(12,2) NOT NULL DEFAULT 300000,
  allowed_merchants JSON NULL,           -- array of merchant ids
  blocked_merchants JSON NULL,           -- array of merchant ids
  allowlist_only TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE agent_payment_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  idempotency_key VARCHAR(80) NOT NULL,
  instruction TEXT NULL,
  payload JSON NOT NULL,
  requested_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_idem (user_id, idempotency_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  merchant_id INT NOT NULL,
  request_id INT NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  description VARCHAR(255),
  status ENUM('APPROVED','BLOCKED','PENDING_APPROVAL','REJECTED','FAILED') NOT NULL,
  risk_score TINYINT UNSIGNED NOT NULL,
  payment_reference VARCHAR(80) NULL,
  executed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_txn_user_status (user_id, status),
  INDEX idx_txn_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  FOREIGN KEY (request_id) REFERENCES agent_payment_requests(id)
) ENGINE=InnoDB;

CREATE TABLE transaction_risk_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  stage ENUM('INITIAL','REVALIDATION') NOT NULL DEFAULT 'INITIAL',
  risk_score TINYINT UNSIGNED NOT NULL,
  risk_level ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  decision ENUM('APPROVED','BLOCKED','PENDING_APPROVAL') NOT NULL,
  factors JSON NOT NULL,
  reasons JSON NOT NULL,
  mandatory_violations JSON NOT NULL,
  engine_version VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_risk_txn (transaction_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payment_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  user_id INT NOT NULL,
  action ENUM('APPROVE','REJECT') NOT NULL,
  outcome VARCHAR(40) NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appr_txn (transaction_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(40),
  entity_id VARCHAR(40),
  details JSON NULL,
  ip VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id, created_at),
  INDEX idx_audit_entity (entity, entity_id)
) ENGINE=InnoDB;
