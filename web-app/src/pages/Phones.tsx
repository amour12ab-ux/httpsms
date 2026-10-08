import React, { useEffect, useState } from 'react'
import { api, Device } from '../api'
import { Card, Table, TR, TD, Badge, Btn, Spinner, Empty, Modal, Input, Label } from '../components/ui'
import { useToast } from '../components/ui'

export default function Phones() {
  const toast = useToast()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [editDev, setEditDev] = useState<Device | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.get<{ devices: Device[] }>('/api/v1/devices')
      .then(d => setDevices(d.devices))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openEdit = (dev: Device) => {
    setEditDev(dev)
    setWebhookUrl('')
  }

  const saveWebhook = async () => {
    if (!editDev) return
    setSaving(true)
    try {
      await api.patch(`/api/v1/devices/${editDev.deviceId}/webhook`, { webhookUrl })
      toast('Webhook updated')
      setEditDev(null)
      load()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (dt: string) => {
    try { return new Date(dt).toLocaleString() } catch { return dt }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Phones</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        List of mobile phones registered for sending and receiving SMS messages.
      </p>

      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : devices.length === 0 ? (
          <Empty text="No phones registered yet. Install the Android app and configure the server URL." />
        ) : (
          <Table heads={['PHONE / DEVICE', 'STATUS', 'LAST SEEN', 'ACTION']}>
            {devices.map(dev => (
              <TR key={dev.deviceId}>
                <TD>
                  <div style={{ fontWeight: 600 }}>{dev.name || 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                    {dev.deviceId.slice(0, 20)}…
                  </div>
                </TD>
                <TD><Badge status={dev.status} /></TD>
                <TD muted>{fmt(dev.lastSeen)}</TD>
                <TD>
                  <Btn size="sm" variant="primary" onClick={() => openEdit(dev)}>✏ Edit</Btn>
                </TD>
              </TR>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={!!editDev} onClose={() => setEditDev(null)} title="Edit Device Webhook">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{editDev?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{editDev?.deviceId}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Label>Webhook URL</Label>
          <Input
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            type="url"
          />
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Incoming SMS from this device will be forwarded to this URL.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="primary" onClick={saveWebhook} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Btn>
          <Btn variant="outline" onClick={() => setEditDev(null)}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  )
}
