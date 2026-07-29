import mysql from 'mysql2/promise';
import { config } from '../config/env';

// Helper to parse MySQL connection URL: mysql://root:password@localhost:3306/email_scheduler
function getPoolConfig() {
  const dbUrl = config.databaseUrl || 'mysql://root:@localhost:3306/email_scheduler';
  try {
    const url = new URL(dbUrl);
    return {
      host: url.hostname || 'localhost',
      port: url.port ? parseInt(url.port, 10) : 3306,
      user: url.username || 'root',
      password: url.password || '',
      database: url.pathname ? url.pathname.replace(/^\//, '') : 'email_scheduler',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
    };
  } catch (e) {
    return {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'email_scheduler',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
    };
  }
}

const poolConfig = getPoolConfig();

// Create connection pool (creates database if not exists using a root connection first)
export const dbPool = mysql.createPool(poolConfig);

/**
 * Helper to run SQL queries with prepared statements
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await dbPool.execute(sql, params);
  return rows as T[];
}

/**
 * Helper to run single query and return first row or null
 */
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Initialize MySQL tables if they do not exist
 */
export async function initDatabaseSchema(): Promise<void> {
  console.log('[MySQL] Initializing database tables with Raw SQL queries...');

  try {
    // 1. Create Database if not exists
    const rootConnConfig = { ...poolConfig, database: undefined };
    const tempConn = await mysql.createConnection(rootConnConfig);
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${poolConfig.database}\`;`);
    await tempConn.end();

    // 2. Users Table
    await dbPool.query(`
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
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Senders Table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS senders (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL,
        smtpUser VARCHAR(191) NOT NULL,
        smtpPass VARCHAR(191) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Scheduled Emails Table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS scheduled_emails (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        senderId VARCHAR(36) NOT NULL,
        recipientEmail VARCHAR(191) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body LONGTEXT NOT NULL,
        scheduledFor DATETIME NOT NULL,
        status ENUM('scheduled', 'sent', 'failed', 'rescheduled') DEFAULT 'scheduled',
        bullJobId VARCHAR(191) NULL,
        attempts INT DEFAULT 0,
        errorMessage LONGTEXT NULL,
        sentAt DATETIME NULL,
        previewUrl VARCHAR(500) NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_scheduledFor (scheduledFor),
        INDEX idx_sender_status (senderId, status),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (senderId) REFERENCES senders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('[MySQL] Database tables and indexes verified successfully.');
  } catch (error: any) {
    console.error('[MySQL] Database initialization error:', error.message);
  }
}
