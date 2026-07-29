-- Email Job Scheduler schema for FreeSQLDatabase/phpMyAdmin.
-- In phpMyAdmin, select your FreeSQLDatabase database first, then import/run this file.
-- Do not add CREATE DATABASE here; FreeSQLDatabase creates the database for you.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(191) UNIQUE NULL,
  name VARCHAR(191) NOT NULL,
  email VARCHAR(191) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NULL,
  googleId VARCHAR(191) UNIQUE NULL,
  avatarUrl VARCHAR(500) NULL,
  resetToken VARCHAR(100) NULL,
  resetTokenExpiry DATETIME NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS senders (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  smtpUser VARCHAR(191) NOT NULL,
  smtpPass VARCHAR(191) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  senderId VARCHAR(36) NOT NULL,
  recipientEmail VARCHAR(191) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body LONGTEXT NOT NULL,
  scheduledFor DATETIME NOT NULL,
  status ENUM('scheduled', 'sent', 'failed', 'rescheduled', 'cancelled') DEFAULT 'scheduled',
  bullJobId VARCHAR(191) NULL,
  attempts INT DEFAULT 0,
  errorMessage LONGTEXT NULL,
  sentAt DATETIME NULL,
  previewUrl VARCHAR(500) NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_scheduledFor (scheduledFor),
  INDEX idx_sender_status (senderId, status),
  CONSTRAINT fk_scheduled_emails_user
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_scheduled_emails_sender
    FOREIGN KEY (senderId) REFERENCES senders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_jobs (
  id VARCHAR(36) PRIMARY KEY,
  scheduledEmailId VARCHAR(36) NOT NULL,
  bullJobId VARCHAR(191) UNIQUE NOT NULL,
  status ENUM('scheduled', 'sent', 'failed', 'rescheduled', 'cancelled') DEFAULT 'scheduled',
  nextRunAt DATETIME NULL,
  delaySeconds INT NULL,
  data LONGTEXT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NULL,
  INDEX idx_job_status (status),
  INDEX idx_nextRunAt (nextRunAt),
  CONSTRAINT fk_email_jobs_scheduled_email
    FOREIGN KEY (scheduledEmailId) REFERENCES scheduled_emails(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sent_emails (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  senderId VARCHAR(36) NOT NULL,
  recipientEmail VARCHAR(191) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body LONGTEXT NOT NULL,
  sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  messageId VARCHAR(255) NULL,
  previewUrl VARCHAR(500) NULL,
  status ENUM('scheduled', 'sent', 'failed', 'rescheduled', 'cancelled') DEFAULT 'sent',
  errorMessage LONGTEXT NULL,
  INDEX idx_sentAt (sentAt),
  INDEX idx_recipient (recipientEmail),
  CONSTRAINT fk_sent_emails_user
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sent_emails_sender
    FOREIGN KEY (senderId) REFERENCES senders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
