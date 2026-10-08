import React, { useEffect, useState } from 'react'
import { api, Status } from '../api'
import { Card, Spinner } from '../components/ui'

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    api.get<Status>('/api/v1/status')
      .then(setStatus)
      .catch(e => setError(e.message))
  }, [])

  const statCard = (label: string, value: number | string, color = 'var(--accent)') => (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  )

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>Dashboard</h1>

      {error && (
        <Card style={{ borderColor: 'var(--danger)', marginBottom: 24 }}>
          <span style={{ color: 'var(--danger)' }}>⚠ {error}</span>
          <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 12 }}>
            Make sure the server is running and your API key is correct.
          </span>
        </Card>
      )}

      {!status && !error && <Spinner />}

      {status && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
            {statCard('Registered Devices', status.devices)}
            {statCard('Messages Sent',      status.messages, 'var(--success)')}
            {statCard('Messages Received',  status.incoming, 'var(--primary)')}
          </div>

          <Card>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Server Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--success)', display: 'inline-block'
              }} />
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>Online</span>
              <span style={{ color: 'var(--muted)' }}>— httpSMS Gateway v{status.version}</span>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
