import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { getDb } from '../models/db';
import dotenv from 'dotenv';

dotenv.config();

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // ── API key (x-api-key header) ────────────────────────────────────────────
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    // Check .env master key first (fast path)
    if (apiKey === process.env.API_KEY) { next(); return; }

    // Check DB-stored keys
    try {
      const db = await getDb();
      const found = await db.get('SELECT id FROM api_keys WHERE key = ?', apiKey);
      if (found) { next(); return; }
    } catch { /* fall through */ }
  }

  // ── Firebase Bearer token (Google Sign-In) ────────────────────────────────
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7);
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      (req as any).user = { uid: decoded.uid, email: decoded.email };
      next(); return;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  }

  res.status(401).json({ error: 'Unauthorized: provide x-api-key or Authorization Bearer token' });
}
