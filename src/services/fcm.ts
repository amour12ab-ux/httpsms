import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

let initialized = false;

export function initFirebase(): boolean {
  if (initialized || admin.apps.length > 0) return true;

  const serviceAccountPath = path.resolve(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || './firebase-service-account.json'
  );

  if (!fs.existsSync(serviceAccountPath)) {
    console.warn('⚠  Firebase service account not found — FCM disabled');
    return false;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    return true;
  } catch (err) {
    console.error('Firebase init error:', err);
    return false;
  }
}

export async function sendSmsNotification(
  token: string,
  messageId: string,
  recipient: string,
  message: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  if (!initFirebase()) {
    return { success: false, error: 'Firebase not initialized' };
  }

  const payload: admin.messaging.Message = {
    token,
    data: { messageId, to: recipient, body: message },
    android: { priority: 'high' },
  };

  try {
    const response = await admin.messaging().send(payload);
    return { success: true, response };
  } catch (err: any) {
    // Surface a clean error message instead of crashing
    const msg: string = err?.errorInfo?.message ?? err?.message ?? String(err);
    console.error('FCM send failed:', msg);
    return { success: false, error: msg };
  }
}
