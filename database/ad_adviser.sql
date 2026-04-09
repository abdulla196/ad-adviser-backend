CREATE DATABASE IF NOT EXISTS ad_adviser
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ad_adviser;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  profile_image_url LONGTEXT NULL,
  phone_country_code VARCHAR(12) NULL,
  phone_number VARCHAR(32) NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'basic',
  google_id VARCHAR(255) NULL,
  is_email_verified TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  UNIQUE KEY users_google_id_unique (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meta_integrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  meta_user_id VARCHAR(255) NULL,
  meta_user_name VARCHAR(255) NULL,
  meta_user_picture_url TEXT NULL,
  access_token LONGTEXT NOT NULL,
  token_type VARCHAR(50) NULL,
  expires_in INT NULL,
  selected_page_id VARCHAR(255) NULL,
  selected_page_name VARCHAR(255) NULL,
  selected_page_picture_url TEXT NULL,
  selected_page_category VARCHAR(255) NULL,
  selected_ad_account_id VARCHAR(255) NULL,
  selected_ad_account_name VARCHAR(255) NULL,
  selected_ad_account_currency VARCHAR(16) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY meta_integrations_user_idx (user_id),
  KEY meta_integrations_user_active_idx (user_id, is_active),
  CONSTRAINT meta_integrations_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
