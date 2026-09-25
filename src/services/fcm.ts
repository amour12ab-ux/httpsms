import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || './firebase-service-account.json'
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

export async function sendSmsNotification(
  token: string,
  messageId: string,
  recipient: string,
  message: string
): Promise<{ success: boolean; response?: string; error?: unknown }> {
  const payload: admin.messaging.Message = {
    token,
    data: {
      messageId,
      to: recipient,
      body: message,
    },
    android: {
      priority: 'high',
    },
  };

  try {
    const response = await admin.messaging().send(payload);
    return { success: true, response };
  } catch (error) {
    console.error('FCM Error:', error);
    return { success: false, error };
  }
}
