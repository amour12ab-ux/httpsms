import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ── Connection pool ───────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// ── Thin wrapper matching the sqlite API used in controllers ──────────────────
// Controllers call: db.get(), db.all(), db.run(), db.exec()
// We wrap pg so the same call signatures work.

export interface DbRow { [key: string]: any }

export class Db {
  private client: Pool;

  constructor(client: Pool) {
    this.client = client;
  }

  /** Returns first row or undefined */
  async get<T = DbRow>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const res = await this.client.query(toPositional(sql), params as any[]);
    return res.rows[0] as T | undefined;
  }

  /** Returns all rows */
  async all<T = DbRow>(sql: string, ...params: unknown[]): Promise<T[]> {
    const res = await this.client.query(toPositional(sql), params as any[]);
    return res.rows as T[];
  }

  /** Execute a write statement, returns { changes } */
  async run(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
    const res = await this.client.query(toPositional(sql), params as any[]);
    return { changes: res.rowCount ?? 0 };
  }

  /** Execute raw SQL (used for DDL / migrations) */
  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }
}

/** Convert SQLite ? placeholders → PostgreSQL $1 $2 … */
function toPositional(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getDb(): Promise<Db> {
  return new Db(pool);
}

export async function initDb(): Promise<void> {
  const db = await getDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      "deviceId" TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devices (
      "deviceId" TEXT PRIMARY KEY,
      "fcmToken" TEXT NOT NULL,
      name TEXT,
      status TEXT DEFAULT 'offline',
      "lastSeen" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "webhookUrl" TEXT
    );

    CREATE TABLE IF NOT EXISTS incoming_messages (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      "deviceId" TEXT NOT NULL,
      "webhookStatus" TEXT DEFAULT 'pending',
      "receivedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      label TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT 'message.phone.received',
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT DEFAULT 'Admin',
      email TEXT DEFAULT '',
      timezone TEXT DEFAULT 'UTC',
      "notifyHeartbeat" INTEGER DEFAULT 1,
      "notifyWebhook" INTEGER DEFAULT 1,
      "notifyStatus" INTEGER DEFAULT 1,
      "notifyNewsletter" INTEGER DEFAULT 1,
      "retentionDays" INTEGER DEFAULT 365
    );

    INSERT INTO user_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);

  console.log('✅ PostgreSQL database initialized');
}
