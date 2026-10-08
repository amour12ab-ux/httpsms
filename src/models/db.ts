import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';

dotenv.config();

export async function getDb() {
  return open({
    filename: process.env.DATABASE_PATH || './sms.db',
    driver: sqlite3.Database,
  });
}

export async function initDb() {
  const db = await getDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      deviceId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS devices (
      deviceId TEXT PRIMARY KEY,
      fcmToken TEXT NOT NULL,
      name TEXT,
      status TEXT DEFAULT 'offline',
      lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS incoming_messages (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      webhookStatus TEXT DEFAULT 'pending',
      receivedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      label TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT 'message.phone.received',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT DEFAULT 'Admin',
      email TEXT DEFAULT '',
      timezone TEXT DEFAULT 'UTC',
      notifyHeartbeat INTEGER DEFAULT 1,
      notifyWebhook INTEGER DEFAULT 1,
      notifyStatus INTEGER DEFAULT 1,
      notifyNewsletter INTEGER DEFAULT 1,
      retentionDays INTEGER DEFAULT 365
    );
    INSERT OR IGNORE INTO user_profile (id) VALUES (1);
  `);
  console.log('Database initialized');
}
