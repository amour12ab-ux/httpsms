import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/db';
import { sendSmsNotification } from '../services/fcm';
import https from 'https';
import http from 'http';

// ─── Outbound SMS ────────────────────────────────────────────────────────────

/** POST /api/v1/send */
export async function sendSms(req: Request, res: Response) {
  const { recipient, message, deviceId } = req.body;
  if (!recipient || !message || !deviceId)
    return res.status(400).json({ error: 'recipient, message, and deviceId are required' });

  const db = await getDb();
  const device = await db.get<{ fcmToken: string }>(
    'SELECT fcmToken FROM devices WHERE deviceId = ?', deviceId
  );
  if (!device) return res.status(404).json({ error: `Device '${deviceId}' not found` });

  const id = uuidv4();
  await db.run(
    `INSERT INTO messages (id, recipient, body, status, deviceId) VALUES (?, ?, ?, 'queued', ?)`,
    id, recipient, message, deviceId
  );

  const fcmResult = await sendSmsNotification(device.fcmToken, id, recipient, message);
  if (!fcmResult.success) {
    await db.run(`UPDATE messages SET status='failed', updatedAt=CURRENT_TIMESTAMP WHERE id=?`, id);
    return res.status(502).json({ error: 'Failed to reach device via FCM', messageId: id });
  }

  await db.run(`UPDATE messages SET status='sent', updatedAt=CURRENT_TIMESTAMP WHERE id=?`, id);
  return res.status(202).json({ messageId: id, status: 'sent' });
}

/** GET /api/v1/messages */
export async function listMessages(req: Request, res: Response) {
  const { status, deviceId, limit = '50', offset = '0' } = req.query as Record<string, string>;
  const db = await getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (deviceId) { conditions.push('deviceId = ?'); params.push(deviceId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const messages = await db.all(
    `SELECT * FROM messages ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    ...params, parseInt(limit), parseInt(offset)
  );
  return res.json({ messages });
}

/** GET /api/v1/messages/:id */
export async function getMessage(req: Request, res: Response) {
  const db = await getDb();
  const msg = await db.get('SELECT * FROM messages WHERE id = ?', req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  return res.json(msg);
}

/** POST /api/v1/callback — Android app reports delivery result */
export async function updateStatus(req: Request, res: Response) {
  const { messageId, status } = req.body;
  if (!messageId || !status)
    return res.status(400).json({ error: 'messageId and status are required' });
  const allowed = ['delivered', 'failed'];
  if (!allowed.includes(status))
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });

  const db = await getDb();
  const result = await db.run(
    `UPDATE messages SET status=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`, status, messageId
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Message not found' });
  return res.json({ messageId, status });
}

// ─── Incoming SMS ────────────────────────────────────────────────────────────

/** POST /api/v1/incoming — Android app forwards received SMS */
export async function receiveIncoming(req: Request, res: Response) {
  const { sender, body, deviceId } = req.body;
  if (!sender || !body || !deviceId)
    return res.status(400).json({ error: 'sender, body, and deviceId are required' });

  const db = await getDb();
  const id = uuidv4();
  await db.run(
    `INSERT INTO incoming_messages (id, sender, body, deviceId) VALUES (?, ?, ?, ?)`,
    id, sender, body, deviceId
  );

  // Forward to webhook if configured for this device
  const device = await db.get<{ webhookUrl?: string }>(
    'SELECT webhookUrl FROM devices WHERE deviceId = ?', deviceId
  );
  if (device?.webhookUrl) {
    forwardToWebhook(device.webhookUrl, { id, sender, body, deviceId }).then((ok) => {
      db.run(
        `UPDATE incoming_messages SET webhookStatus=? WHERE id=?`,
        ok ? 'delivered' : 'failed', id
      );
    });
  }

  return res.status(201).json({ id });
}

/** GET /api/v1/incoming */
export async function listIncoming(req: Request, res: Response) {
  const { deviceId, limit = '50', offset = '0' } = req.query as Record<string, string>;
  const db = await getDb();
  const conditions = deviceId ? 'WHERE deviceId = ?' : '';
  const params = deviceId ? [deviceId] : [];
  const messages = await db.all(
    `SELECT * FROM incoming_messages ${conditions} ORDER BY receivedAt DESC LIMIT ? OFFSET ?`,
    ...params, parseInt(limit), parseInt(offset)
  );
  return res.json({ messages });
}

// ─── Devices ─────────────────────────────────────────────────────────────────

/** POST /api/v1/devices/register */
export async function registerDevice(req: Request, res: Response) {
  const { deviceId, fcmToken, name } = req.body;
  if (!deviceId || !fcmToken)
    return res.status(400).json({ error: 'deviceId and fcmToken are required' });

  const db = await getDb();
  await db.run(
    `INSERT INTO devices (deviceId, fcmToken, name, status, lastSeen)
     VALUES (?, ?, ?, 'online', CURRENT_TIMESTAMP)
     ON CONFLICT(deviceId) DO UPDATE SET
       fcmToken=excluded.fcmToken,
       name=COALESCE(excluded.name, name),
       status='online',
       lastSeen=CURRENT_TIMESTAMP`,
    deviceId, fcmToken, name ?? null
  );
  return res.status(201).json({ deviceId, status: 'registered' });
}

/** GET /api/v1/devices */
export async function listDevices(req: Request, res: Response) {
  const db = await getDb();
  const devices = await db.all('SELECT deviceId, name, status, lastSeen FROM devices');
  return res.json({ devices });
}

/** PATCH /api/v1/devices/:deviceId/webhook */
export async function setWebhook(req: Request, res: Response) {
  const { webhookUrl } = req.body;
  if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl is required' });

  const db = await getDb();

  // Add webhookUrl column if it doesn't exist yet (safe migration)
  await db.run(`ALTER TABLE devices ADD COLUMN webhookUrl TEXT`).catch(() => {});

  const result = await db.run(
    'UPDATE devices SET webhookUrl=? WHERE deviceId=?', webhookUrl, req.params.deviceId
  );
  if (result.changes === 0) return res.status(404).json({ error: 'Device not found' });
  return res.json({ deviceId: req.params.deviceId, webhookUrl });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function forwardToWebhook(url: string, payload: object): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const data = Buffer.from(JSON.stringify(payload));
      const lib = url.startsWith('https') ? https : http;
      const parsed = new URL(url);
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
      }, (res) => resolve(res.statusCode !== undefined && res.statusCode < 400));
      req.on('error', () => resolve(false));
      req.write(data);
      req.end();
    } catch {
      resolve(false);
    }
  });
}
