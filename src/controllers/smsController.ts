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

// ─── Status / config check ────────────────────────────────────────────────────

/** GET /api/v1/status — returns server info and device count */
export async function checkConfig(req: Request, res: Response) {
  const db = await getDb();
  const deviceCount   = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM devices');
  const messageCount  = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM messages');
  const incomingCount = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM incoming_messages');

  return res.json({
    status: 'ok',
    version: '1.0.0',
    devices:  deviceCount?.count  ?? 0,
    messages: messageCount?.count ?? 0,
    incoming: incomingCount?.count ?? 0,
  });
}

// ─── API Key management ───────────────────────────────────────────────────────

/** POST /api/v1/apikeys — generate a new API key */
export async function createApiKey(req: Request, res: Response) {
  const { label } = req.body;
  const db = await getDb();
  const id  = uuidv4();
  const key = `hsk_${uuidv4().replace(/-/g, '')}`;   // e.g. hsk_abc123...
  await db.run(
    `INSERT INTO api_keys (id, key, label) VALUES (?, ?, ?)`,
    id, key, label ?? 'My Key'
  );
  return res.status(201).json({ id, key, label: label ?? 'My Key' });
}

/** GET /api/v1/apikeys — list all keys (key value masked) */
export async function listApiKeys(req: Request, res: Response) {
  const db = await getDb();
  const keys = await db.all(
    `SELECT id, label, substr(key,1,10) || '••••••••' as keyPreview, createdAt FROM api_keys ORDER BY createdAt DESC`
  );
  return res.json({ keys });
}

/** DELETE /api/v1/apikeys/:id — revoke a key */
export async function deleteApiKey(req: Request, res: Response) {
  const db = await getDb();
  const result = await db.run(`DELETE FROM api_keys WHERE id = ?`, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Key not found' });
  return res.json({ deleted: true });
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export async function listWebhooks(req: Request, res: Response) {
  const db = await getDb();
  const webhooks = await db.all('SELECT * FROM webhooks ORDER BY createdAt DESC');
  return res.json({ webhooks });
}

export async function createWebhook(req: Request, res: Response) {
  const { url, events } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const db = await getDb();
  const id = uuidv4();
  await db.run(
    `INSERT INTO webhooks (id, url, events) VALUES (?, ?, ?)`,
    id, url, events ?? 'message.phone.received'
  );
  return res.status(201).json({ id, url, events: events ?? 'message.phone.received' });
}

export async function updateWebhook(req: Request, res: Response) {
  const { url, events } = req.body;
  const db = await getDb();
  const fields: string[] = [];
  const params: unknown[] = [];
  if (url)    { fields.push('url = ?');    params.push(url); }
  if (events) { fields.push('events = ?'); params.push(events); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  const result = await db.run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, ...params);
  if (result.changes === 0) return res.status(404).json({ error: 'Webhook not found' });
  return res.json({ id: req.params.id, url, events });
}

export async function deleteWebhook(req: Request, res: Response) {
  const db = await getDb();
  const result = await db.run('DELETE FROM webhooks WHERE id = ?', req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Webhook not found' });
  return res.json({ deleted: true });
}

// ─── Rotate API Key ───────────────────────────────────────────────────────────

export async function rotateApiKey(req: Request, res: Response) {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required' });
  const db = await getDb();
  const existing = await db.get<{ label: string }>('SELECT label FROM api_keys WHERE id = ?', id);
  if (!existing) return res.status(404).json({ error: 'Key not found' });
  const newKey = `hsk_${uuidv4().replace(/-/g, '')}`;
  await db.run('UPDATE api_keys SET key = ? WHERE id = ?', newKey, id);
  return res.json({ id, key: newKey, label: existing.label });
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getProfile(req: Request, res: Response) {
  const db = await getDb();
  const profile = await db.get('SELECT * FROM user_profile WHERE id = 1');
  return res.json(profile);
}

export async function updateProfile(req: Request, res: Response) {
  const { name, email, timezone, notifyHeartbeat, notifyWebhook,
          notifyStatus, notifyNewsletter, retentionDays } = req.body;
  const db = await getDb();
  await db.run(`
    UPDATE user_profile SET
      name = COALESCE(?, name),
      email = COALESCE(?, email),
      timezone = COALESCE(?, timezone),
      notifyHeartbeat = COALESCE(?, notifyHeartbeat),
      notifyWebhook = COALESCE(?, notifyWebhook),
      notifyStatus = COALESCE(?, notifyStatus),
      notifyNewsletter = COALESCE(?, notifyNewsletter),
      retentionDays = COALESCE(?, retentionDays)
    WHERE id = 1`,
    name ?? null, email ?? null, timezone ?? null,
    notifyHeartbeat ?? null, notifyWebhook ?? null,
    notifyStatus ?? null, notifyNewsletter ?? null, retentionDays ?? null
  );
  const profile = await db.get('SELECT * FROM user_profile WHERE id = 1');
  return res.json(profile);
}
