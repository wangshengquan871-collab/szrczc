-- MySQL 8.0.16+. This script creates missing objects; it never drops or clears data.
-- Use npm run db:init with connection settings from .env, or run in MySQL Workbench.
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS `suzhou_talent_policy`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

USE `suzhou_talent_policy`;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(30) COLLATE utf8mb4_0900_as_ci NOT NULL,
  email VARCHAR(254) COLLATE utf8mb4_0900_as_ci NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  -- Roles are controlled by the server; registration always uses the user default.
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_status_role (status, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires BIGINT UNSIGNED NOT NULL,
  data LONGTEXT NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (session_id),
  KEY ix_sessions_expiry (expires),
  KEY ix_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_sessions_json CHECK (JSON_VALID(data))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS login_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  identifier_hash BINARY(32) NOT NULL,
  success BOOLEAN NOT NULL,
  reason VARCHAR(32) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_login_user_time (user_id, created_at),
  KEY ix_login_time (created_at),
  CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
