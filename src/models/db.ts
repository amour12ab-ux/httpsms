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
  `);
  console.log('Database initialized');
}
