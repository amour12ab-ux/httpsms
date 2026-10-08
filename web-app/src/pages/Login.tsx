import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { setStoredKey } from '../api'
import { Btn, Input, Label } from '../components/ui'
import { useToast } from '../components/ui'

export default function Login() {
  const toast    = useToast()
  const navigate = useNavigate()
  const [serverUrl, setServerUrl] = useState(
    import.meta.env.VITE_API_URL ?? 'https://httpsms-ckx5.onrender.com'
  )
  const [apiKey, setApiKey]       = useState('')
  const [loading, setLoading]     = useState(false)

  const connect = async () => {
    if (!apiKey.trim()) { toast('Enter your API Key', 'error'); return }
    setLoading(true)
    try {
      setStoredKey(apiKey.trim())
      await api.get('/api/v1/status')
      toast('Connected!')
      navigate('/')
    } catch (e: any) {
      toast('Connection failed: ' + e.message, 'error')
      setStoredKey('')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
            httpSMS
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>SMS Gateway Dashboard</p>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 32,
        }}>
          <div style={{ marginBottom: 20 }}>
            <Label>Server URL</Label>
            <Input
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000"
              type="url"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <Label>API Key</Label>
            <Input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="hsk_••••••••••••••••••••••••••••••••"
              type="password"
              onKeyDown={e => e.key === 'Enter' && connect()}
            />
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
              Your API key from the server's <code>.env</code> file or generated in Settings.
            </div>
          </div>

          <Btn
            variant="primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}
            onClick={connect}
            disabled={loading}
          >
            {loading ? 'Connecting…' : '→ Connect to Server'}
          </Btn>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 20 }}>
          Make sure your httpSMS server is running before connecting.
        </p>
      </div>
    </div>
  )
}
