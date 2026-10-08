const BASE = import.meta.env.VITE_API_URL ?? 'https://httpsms-ckx5.onrender.com'

export function getStoredKey() {
  return localStorage.getItem('httpsms_key') || ''
}
export function setStoredKey(k: string) {
  localStorage.setItem('httpsms_key', k)
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = getStoredKey()
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'x-api-key': key } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).error || res.statusText)
  }
  return res.status === 204 ? (null as T) : res.json()
}

export const api = {
  get:    <T>(path: string)              => req<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => req<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown) => req<T>('PATCH',  path, body),
  delete: <T>(path: string)              => req<T>('DELETE', path),
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Status { status: string; version: string; devices: number; messages: number; incoming: number }
export interface Device { deviceId: string; name: string; status: string; lastSeen: string }
export interface OutMsg  { id: string; recipient: string; body: string; status: string; createdAt: string }
export interface InMsg   { id: string; sender: string; body: string; webhookStatus: string; receivedAt: string }
export interface ApiKey  { id: string; label: string; keyPreview: string; createdAt: string }
export interface Webhook { id: string; url: string; events: string }
export interface Profile {
  name: string; email: string; timezone: string
  notifyHeartbeat: number; notifyWebhook: number; notifyStatus: number; notifyNewsletter: number
  retentionDays: number
}
