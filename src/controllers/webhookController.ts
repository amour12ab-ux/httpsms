import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../models/db';
import { parseSms } from '../services/smsParser';

const MIN_AUTO_CREDIT = 50; // ETB — below this, skip auto-credit

/** POST /api/sms-webhook — receives httpSMS webhook events (CloudEvents format)
 *
 * Real httpSMS payload:
 * {
 *   "type": "message.phone.received",
 *   "data": {
 *     "contact": "+251911234567",   <- sender phone
 *     "content": "You have received ETB 100.00...",
 *     "owner":   "+251922000000",   <- your phone number
 *     "message_id": "...",
 *     "timestamp": "...",
 *     ...
 *   }
 * }
 */
export async function smsWebhook(req: Request, res: Response) {
  // Support both top-level "type" (CloudEvents) and X-Event-Type header
  const eventType: string = req.body?.type ?? req.headers['x-event-type'] ?? '';

  if (eventType !== 'message.phone.received') {
    return res.json({ status: 'ignored', reason: `event type '${eventType}' not handled` });
  }

  const smsBody: string = req.body?.data?.content ?? '';
  const contact: string = req.body?.data?.contact ?? '';

  const parsed = parseSms(smsBody);
  if (!parsed) {
    return res.json({ status: 'ignored', reason: 'not a recognised payment SMS' });
  }

  const db = await getDb();
  const depositId = uuidv4();

  // Look up player by the sender phone from the SMS body
  const player = await db.get<{ id: string; phone: string; balance: number }>(
    'SELECT id, phone, balance FROM players WHERE phone = ?',
    parsed.phone
  );

  if (player) {
    // Auto-credit wallet
    await db.run('UPDATE players SET balance = balance + ? WHERE id = ?', parsed.amount, player.id);
    await db.run(
      `INSERT INTO deposits (id, playerId, phone, amount, reference, provider, rawSms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'credited')`,
      depositId, player.id, parsed.phone, parsed.amount, parsed.reference, parsed.provider, smsBody
    );
    return res.json({
      status: 'success',
      action: 'auto_credited',
      playerId: player.id,
      amount: parsed.amount,
      newBalance: player.balance + parsed.amount,
    });
  }

  // No matching player found
  if (parsed.amount >= MIN_AUTO_CREDIT) {
    // Create pending deposit for admin review
    await db.run(
      `INSERT INTO deposits (id, playerId, phone, amount, reference, provider, rawSms, status)
       VALUES (?, NULL, ?, ?, ?, ?, ?, 'pending')`,
      depositId, parsed.phone, parsed.amount, parsed.reference, parsed.provider, smsBody
    );
    return res.json({
      status: 'success',
      action: 'pending_review',
      reason: 'no player matched, deposit queued for admin',
      depositId,
      amount: parsed.amount,
      phone: parsed.phone,
    });
  }

  return res.json({ status: 'ignored', reason: 'amount below minimum and no player matched' });
}

// ─── Player Management ───────────────────────────────────────────────────────

/** POST /api/players */
export async function createPlayer(req: Request, res: Response) {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const db = await getDb();
  const id = uuidv4();
  try {
    await db.run(
      'INSERT INTO players (id, phone, name) VALUES (?, ?, ?)',
      id, normalizePhone(phone), name ?? null
    );
    return res.status(201).json({ id, phone: normalizePhone(phone), name, balance: 0 });
  } catch {
    return res.status(409).json({ error: 'Phone number already registered' });
  }
}

/** GET /api/players */
export async function listPlayers(req: Request, res: Response) {
  const db = await getDb();
  const players = await db.all('SELECT id, phone, name, balance, createdAt FROM players ORDER BY createdAt DESC');
  return res.json({ players });
}

/** GET /api/players/:id */
export async function getPlayer(req: Request, res: Response) {
  const db = await getDb();
  const player = await db.get('SELECT id, phone, name, balance, createdAt FROM players WHERE id = ?', req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found' });
  return res.json(player);
}

/** PATCH /api/players/:id/balance — manual adjustment */
export async function adjustBalance(req: Request, res: Response) {
  const { amount, note } = req.body;
  if (typeof amount !== 'number') return res.status(400).json({ error: 'amount must be a number' });

  const db = await getDb();
  const player = await db.get<{ id: string; balance: number }>(
    'SELECT id, balance FROM players WHERE id = ?', req.params.id
  );
  if (!player) return res.status(404).json({ error: 'Player not found' });

  await db.run('UPDATE players SET balance = balance + ? WHERE id = ?', amount, player.id);
  return res.json({ playerId: player.id, adjustment: amount, newBalance: player.balance + amount, note });
}

// ─── Deposit Management ──────────────────────────────────────────────────────

/** GET /api/deposits */
export async function listDeposits(req: Request, res: Response) {
  const { status } = req.query as Record<string, string>;
  const db = await getDb();
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const deposits = await db.all(
    `SELECT * FROM deposits ${where} ORDER BY createdAt DESC LIMIT 100`,
    ...params
  );
  return res.json({ deposits });
}

/** POST /api/deposits/:id/approve — admin approves a pending deposit */
export async function approveDeposit(req: Request, res: Response) {
  const db = await getDb();
  const deposit = await db.get<{ id: string; playerId: string | null; phone: string; amount: number; status: string }>(
    'SELECT * FROM deposits WHERE id = ?', req.params.id
  );
  if (!deposit) return res.status(404).json({ error: 'Deposit not found' });
  if (deposit.status !== 'pending') return res.status(400).json({ error: 'Deposit is not pending' });

  const { playerId: overridePlayerId } = req.body;
  const targetPlayerId = overridePlayerId ?? deposit.playerId;

  if (!targetPlayerId) return res.status(400).json({ error: 'Provide playerId to assign this deposit to' });

  const player = await db.get<{ id: string; balance: number }>(
    'SELECT id, balance FROM players WHERE id = ?', targetPlayerId
  );
  if (!player) return res.status(404).json({ error: 'Player not found' });

  await db.run('UPDATE players SET balance = balance + ? WHERE id = ?', deposit.amount, player.id);
  await db.run('UPDATE deposits SET status = ?, playerId = ? WHERE id = ?', 'credited', player.id, deposit.id);

  return res.json({ status: 'credited', playerId: player.id, amount: deposit.amount, newBalance: player.balance + deposit.amount });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length === 12) return '0' + digits.slice(3);
  return digits.startsWith('0') ? digits : '0' + digits;
}
