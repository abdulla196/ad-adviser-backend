const mysql = require('mysql2/promise');

const logger = require('./logger');

let pool;

const isDatabaseConfigured = () => Boolean(process.env.MYSQL_DATABASE);

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      queueLimit: 0,
    });
  }

  return pool;
};

const initializeDatabase = async () => {
  if (!isDatabaseConfigured()) {
    logger.warn('MySQL auth database is not configured. Auth endpoints will be unavailable until MYSQL_DATABASE is set.');
    return false;
  }

  const db = getPool();
  await db.query(`
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
  `);

  await db.query(`
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
  `);

  const [profileImageColumn] = await db.query("SHOW COLUMNS FROM users LIKE 'profile_image_url'");
  if (!profileImageColumn.length) {
    await db.query('ALTER TABLE users ADD COLUMN profile_image_url LONGTEXT NULL AFTER last_name');
  }

  logger.info('MySQL auth table ready');
  return true;
};

module.exports = {
  getPool,
  initializeDatabase,
  isDatabaseConfigured,
};