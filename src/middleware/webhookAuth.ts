import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validates the JWT Bearer token sent by httpSMS in the Authorization header.
 * httpSMS signs the JWT with HS256 using the webhook signing key.
 * Docs: https://docs.httpsms.com/webhooks
 */
export function webhookAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const signingKey = process.env.SMS_WEBHOOK_SECRET ?? '';

  if (!signingKey) {
    console.warn('SMS_WEBHOOK_SECRET not set — webhook is unprotected!');
    return next();
  }

  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing Authorization header' });
  }

  try {
    jwt.verify(token, signingKey, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: invalid webhook signature' });
  }
}
