import express from 'express';
import dotenv from 'dotenv';
import { initDb } from './models/db';
import { authMiddleware } from './middleware/auth';
import {
  sendSms,
  listMessages,
  getMessage,
  updateStatus,
  receiveIncoming,
  listIncoming,
  registerDevice,
  listDevices,
  setWebhook,
} from './controllers/smsController';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health
app.get('/', (_, res) => res.send('HTTPSMS Gateway running'));

// Outbound SMS
app.post('/api/v1/send', authMiddleware, sendSms);
app.get('/api/v1/messages', authMiddleware, listMessages);
app.get('/api/v1/messages/:id', authMiddleware, getMessage);

// Callbacks from Android app (no auth — device uses its own deviceId)
app.post('/api/v1/callback', updateStatus);
app.post('/api/v1/incoming', receiveIncoming);

// Incoming message history
app.get('/api/v1/incoming', authMiddleware, listIncoming);

// Device management
app.post('/api/v1/devices/register', registerDevice);
app.get('/api/v1/devices', authMiddleware, listDevices);
app.patch('/api/v1/devices/:deviceId/webhook', authMiddleware, setWebhook);

async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}

startServer();
