import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// Allow self-signed certs for Aiven PostgreSQL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { initDb } from './models/db';
import { initFirebase } from './services/fcm';
import { authMiddleware } from './middleware/auth';
import {
  sendSms, listMessages, getMessage, updateStatus,
  receiveIncoming, listIncoming, registerDevice, listDevices,
  setWebhook, checkConfig, createApiKey, listApiKeys, deleteApiKey,
  listWebhooks, createWebhook, updateWebhook, deleteWebhook,
  rotateApiKey, getProfile, updateProfile,
} from './controllers/smsController';

dotenv.config();

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed = (process.env.CORS_ORIGIN || '*').replace(/\/$/, '');
  const match = allowed === '*' || origin.replace(/\/$/, '') === allowed;
  res.setHeader('Access-Control-Allow-Origin', match ? origin : allowed);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

const PORT = process.env.PORT || 3000;

// Serve web dashboard
app.use(express.static(path.join(__dirname, '../web')));
app.get('/dashboard', (_, res) => res.sendFile(path.join(__dirname, '../web/index.html')));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/', (_, res) => res.json({ status: 'ok', service: 'HTTPSMS Gateway', version: '1.0.0' }));
app.get('/api/v1/status', authMiddleware, checkConfig);

// ─── Profile ──────────────────────────────────────────────────────────────────
app.get('/api/v1/profile', authMiddleware, getProfile);
app.patch('/api/v1/profile', authMiddleware, updateProfile);

// ─── Outbound SMS ─────────────────────────────────────────────────────────────
app.post('/api/v1/send', authMiddleware, sendSms);
app.get('/api/v1/messages', authMiddleware, listMessages);
app.get('/api/v1/messages/:id', authMiddleware, getMessage);

// ─── Callbacks from Android ───────────────────────────────────────────────────
app.post('/api/v1/callback', updateStatus);
app.post('/api/v1/incoming', receiveIncoming);

// ─── Incoming history ─────────────────────────────────────────────────────────
app.get('/api/v1/incoming', authMiddleware, listIncoming);

// ─── Devices ──────────────────────────────────────────────────────────────────
app.post('/api/v1/devices/register', registerDevice);
app.get('/api/v1/devices', authMiddleware, listDevices);
app.patch('/api/v1/devices/:deviceId/webhook', authMiddleware, setWebhook);

// ─── API Keys ─────────────────────────────────────────────────────────────────
app.post('/api/v1/apikeys', authMiddleware, createApiKey);
app.get('/api/v1/apikeys', authMiddleware, listApiKeys);
app.delete('/api/v1/apikeys/:id', authMiddleware, deleteApiKey);
app.post('/api/v1/apikeys/rotate', authMiddleware, rotateApiKey);

// ─── Webhooks ─────────────────────────────────────────────────────────────────
app.get('/api/v1/webhooks', authMiddleware, listWebhooks);
app.post('/api/v1/webhooks', authMiddleware, createWebhook);
app.patch('/api/v1/webhooks/:id', authMiddleware, updateWebhook);
app.delete('/api/v1/webhooks/:id', authMiddleware, deleteWebhook);

async function startServer() {
  try {
    await initDb();
    initFirebase();
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
