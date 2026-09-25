# HttpSMS Gateway

Use your Android phone as an SMS gateway. Send and receive SMS via a simple HTTP API.

---

## Architecture

```
Client → POST /api/v1/send → Backend → FCM → Android App → SIM → Recipient
                                                   ↓
                               POST /api/v1/callback (delivered/failed)

Recipient → SMS → Android App → POST /api/v1/incoming → Backend → Webhook
```

---

## 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project.
2. Add an Android app with package name `com.httpsms`.
3. Download `google-services.json` → place in `android/app/`.
4. Go to Project Settings → Service Accounts → Generate new private key.
5. Save the file as `firebase-service-account.json` in the project root.

---

## 2. Backend Setup

```bash
npm install
```

Edit `.env`:

```env
PORT=3000
API_KEY=your_secret_key_here
DATABASE_PATH=./sms.db
FIREBASE_SERVICE_ACCOUNT_JSON=./firebase-service-account.json
```

Start the server:

```bash
npm run dev
```

---

## 3. Android App Setup

1. Open the `android/` folder in Android Studio.
2. Place your `google-services.json` in `android/app/`.
3. Build and install on your Android device (`Run > Run 'app'`).
4. Open the app, enter:
   - **Server URL** — your server's IP/domain (e.g. `http://192.168.1.10:3000`)
   - **API Key** — same value as `API_KEY` in `.env`
   - **Device ID** — auto-generated, or set your own
5. Tap **Save & Register** — grant SMS and notification permissions when prompted.

---

## 4. API Reference

All endpoints except `/callback`, `/incoming`, and `/devices/register` require the header:
```
x-api-key: your_secret_key_here
```

### Send SMS
```
POST /api/v1/send
{ "recipient": "+1234567890", "message": "Hello", "deviceId": "my-phone" }
```

### Delivery callback (called by Android app)
```
POST /api/v1/callback
{ "messageId": "uuid", "status": "delivered" | "failed" }
```

### Incoming SMS (called by Android app)
```
POST /api/v1/incoming
{ "sender": "+1234567890", "body": "Hello back", "deviceId": "my-phone" }
```

### List outbound messages
```
GET /api/v1/messages?deviceId=my-phone&status=delivered&limit=50
```

### List inbound messages
```
GET /api/v1/incoming?deviceId=my-phone
```

### Register / update device
```
POST /api/v1/devices/register
{ "deviceId": "my-phone", "fcmToken": "...", "name": "Pixel 7" }
```

### List devices
```
GET /api/v1/devices
```

### Set webhook for incoming SMS
```
PATCH /api/v1/devices/:deviceId/webhook
{ "webhookUrl": "https://yourserver.com/sms-hook" }
```

---

## 5. Incoming SMS Webhook

When a webhook URL is configured for a device, every incoming SMS is forwarded as:

```json
POST https://yourserver.com/sms-hook
{
  "id": "uuid",
  "sender": "+1234567890",
  "body": "Hello",
  "deviceId": "my-phone"
}
```
