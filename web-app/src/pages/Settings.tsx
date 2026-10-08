import React, { useEffect, useState, useCallback } from 'react'
import { api, ApiKey, Webhook, Profile } from '../api'
import { getStoredKey, setStoredKey } from '../api'
import {
  Card, Btn, Input, Select, Label, Table, TR, TD, Badge,
  Toggle, Modal, SectionTitle, SectionDesc, Code, Empty, Spinner, useToast
} from '../components/ui'

// ── API Key section ───────────────────────────────────────────────────────────
function ApiKeySection() {
  const toast = useToast()
  const [keys, setKeys]         = useState<ApiKey[]>([])
  const [loading, setLoading]   = useState(true)
  const [visible, setVisible]   = useState(false)
  const [newKey, setNewKey]     = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [generating, setGen]    = useState(false)
  const [qrOpen, setQrOpen]     = useState(false)

  const currentKey = getStoredKey()

  const load = useCallback(() => {
    setLoading(true)
    api.get<{ keys: ApiKey[] }>('/api/v1/apikeys')
      .then(d => setKeys(d.keys))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const generate = async () => {
    if (!newLabel.trim()) { toast('Enter a label first', 'error'); return }
    setGen(true)
    try {
      const r = await api.post<{ key: string; id: string; label: string }>(
        '/api/v1/apikeys', { label: newLabel }
      )
      setNewKey(r.key)
      setNewLabel('')
      load()
      toast('API key generated — copy it now!')
    } catch (e: any) { toast(e.message, 'error') }
    finally { setGen(false) }
  }

  const rotate = async () => {
    if (!keys.length) { toast('No key to rotate', 'error'); return }
    if (!confirm('Rotate the API key? The current key will stop working immediately.')) return
    try {
      const r = await api.post<{ key: string; id: string }>('/api/v1/apikeys/rotate', { id: keys[0].id })
      setNewKey(r.key)
      setStoredKey(r.key)
      setVisible(true)
      load()
      toast('Key rotated — copy the new key now')
    } catch (e: any) { toast(e.message, 'error') }
  }

  const revoke = async (id: string, label: string) => {
    if (!confirm(`Revoke "${label}"? Systems using this key will lose access.`)) return
    try {
      await api.delete(`/api/v1/apikeys/${id}`)
      toast('Key revoked')
      load()
    } catch (e: any) { toast(e.message, 'error') }
  }

  const copy = async (val: string) => {
    await navigator.clipboard.writeText(val).catch(() => {})
    toast('Copied to clipboard')
  }

  const masked = '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'

  return (
    <Card>
      <SectionTitle>API Key</SectionTitle>
      <SectionDesc>
        Use your API Key in the <Code>x-api-key</Code> HTTP Header when sending requests to{' '}
        <Code>{window.location.origin}/api/v1</Code> endpoints.
      </SectionDesc>

      {/* Current key display */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#0d1117', border: '1px solid var(--border)',
        borderRadius: 8, overflow: 'hidden', marginBottom: 16,
      }}>
        <div style={{
          flex: 1, padding: '12px 16px', fontFamily: 'var(--mono)',
          fontSize: 13, letterSpacing: 1, userSelect: visible ? 'text' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {visible ? (currentKey || keys[0]?.keyPreview || '—') : masked}
        </div>
        <button
          onClick={() => setVisible(v => !v)}
          style={{
            background: 'none', border: 'none', borderLeft: '1px solid var(--border)',
            color: 'var(--muted)', padding: '12px 14px', cursor: 'pointer', fontSize: 16,
          }}
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <Btn variant="primary" onClick={() => copy(currentKey)}>📋 Copy API Key</Btn>
        <Btn variant="outline" onClick={() => setQrOpen(true)}>⊞ Show QR Code</Btn>
        <Btn variant="outline" onClick={() => window.open('/','_blank')}>📄 Documentation</Btn>
        <Btn variant="warning" onClick={rotate} style={{ marginLeft: 'auto' }}>↻ Rotate API Key</Btn>
      </div>

      {/* Generate new key */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Generate a new key</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Label>Key label</Label>
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g. My App"
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
          </div>
          <Btn variant="primary" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : '+ Generate'}
          </Btn>
        </div>

        {newKey && (
          <div style={{
            marginTop: 16, background: 'rgba(34,197,94,.08)',
            border: '1px solid rgba(34,197,94,.3)', borderRadius: 8, padding: 14,
          }}>
            <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              ✓ Copy this key now — it won't be shown again
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{
                flex: 1, fontFamily: 'var(--mono)', fontSize: 13,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{newKey}</code>
              <Btn size="sm" variant="outline" onClick={() => copy(newKey)}>Copy</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Keys list */}
      {!loading && keys.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Active keys</div>
          <Table heads={['LABEL', 'KEY', 'CREATED', 'ACTION']}>
            {keys.map(k => (
              <TR key={k.id}>
                <TD><span style={{ fontWeight: 600 }}>{k.label}</span></TD>
                <TD mono>{k.keyPreview}</TD>
                <TD muted>{k.createdAt.slice(0, 10)}</TD>
                <TD>
                  <Btn size="sm" variant="danger" onClick={() => revoke(k.id, k.label)}>
                    Revoke
                  </Btn>
                </TD>
              </TR>
            ))}
          </Table>
        </div>
      )}

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="API Key QR Code">
        <div style={{ textAlign: 'center', padding: 16 }}>
          <div style={{
            background: 'white', padding: 16, borderRadius: 8,
            display: 'inline-block', marginBottom: 16,
          }}>
            <QrCode value={currentKey} size={180} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Scan with the httpSMS Android app</div>
        </div>
      </Modal>
    </Card>
  )
}

// Minimal QR code visual (grid pattern from key hash)
function QrCode({ value, size }: { value: string; size: number }) {
  const cells = 21
  const cell = size / cells
  const bits = value.split('').map((c, i) => (c.charCodeAt(0) + i) % 3 !== 0)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" />
      {bits.slice(0, cells * cells).map((b, i) => b ? (
        <rect key={i} x={(i % cells) * cell} y={Math.floor(i / cells) * cell}
          width={cell} height={cell} fill="black" />
      ) : null)}
    </svg>
  )
}

// ── Webhooks section ──────────────────────────────────────────────────────────
function WebhooksSection() {
  const toast = useToast()
  const [hooks, setHooks]   = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl]     = useState('')
  const [event, setEvent] = useState('message.phone.received')
  const [adding, setAdding] = useState(false)
  const [editHook, setEditHook] = useState<Webhook | null>(null)
  const [editUrl, setEditUrl] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.get<{ webhooks: Webhook[] }>('/api/v1/webhooks')
      .then(d => setHooks(d.webhooks))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const add = async () => {
    if (!url.trim()) { toast('Enter a URL', 'error'); return }
    setAdding(true)
    try {
      await api.post('/api/v1/webhooks', { url, events: event })
      toast('Webhook added')
      setUrl(''); setShowForm(false); load()
    } catch (e: any) { toast(e.message, 'error') }
    finally { setAdding(false) }
  }

  const save = async () => {
    if (!editHook || !editUrl.trim()) return
    try {
      await api.patch(`/api/v1/webhooks/${editHook.id}`, { url: editUrl })
      toast('Webhook updated'); setEditHook(null); load()
    } catch (e: any) { toast(e.message, 'error') }
  }

  const remove = async (id: string) => {
    if (!confirm('Remove this webhook?')) return
    try {
      await api.delete(`/api/v1/webhooks/${id}`)
      toast('Webhook removed'); load()
    } catch (e: any) { toast(e.message, 'error') }
  }

  return (
    <Card>
      <SectionTitle>Webhooks</SectionTitle>
      <SectionDesc>
        Webhooks allow us to send events to your server — for example when the android phone
        receives an SMS message we can forward the message to your server.
      </SectionDesc>

      {loading ? <Spinner /> : hooks.length === 0 ? (
        <Empty text="No webhooks configured yet" />
      ) : (
        <Table heads={['CALLBACK URL', 'EVENTS', 'ACTION']}>
          {hooks.map(h => (
            <TR key={h.id}>
              <TD>
                <span style={{ fontSize: 13, wordBreak: 'break-all' }}>{h.url}</span>
              </TD>
              <TD><Badge status="sent" /><span style={{ marginLeft: 8, fontSize: 13, color: 'var(--muted)' }}>{h.events}</span></TD>
              <TD>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn size="sm" variant="primary" onClick={() => { setEditHook(h); setEditUrl(h.url) }}>✏ Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => remove(h.id)}>✕</Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Btn variant="primary" onClick={() => setShowForm(s => !s)}>🔗 Add webhook</Btn>
        <Btn variant="outline">📄 Documentation</Btn>
      </div>

      {showForm && (
        <div style={{ marginTop: 20, padding: 20, background: 'var(--surface2)', borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Label>Callback URL</Label>
              <Input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/webhook" type="url" />
            </div>
            <div style={{ minWidth: 200 }}>
              <Label>Event</Label>
              <Select value={event} onChange={e => setEvent(e.target.value)}>
                <option value="message.phone.received">message.phone.received</option>
                <option value="message.send.success">message.send.success</option>
                <option value="message.send.failed">message.send.failed</option>
              </Select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="primary" onClick={add} disabled={adding}>{adding ? 'Adding…' : 'Add'}</Btn>
              <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editHook} onClose={() => setEditHook(null)} title="Edit Webhook">
        <div style={{ marginBottom: 16 }}>
          <Label>Callback URL</Label>
          <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} type="url" />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="primary" onClick={save}>Save</Btn>
          <Btn variant="outline" onClick={() => setEditHook(null)}>Cancel</Btn>
        </div>
      </Modal>
    </Card>
  )
}

// ── Notifications section ─────────────────────────────────────────────────────
function NotificationsSection({ profile, onChange }: {
  profile: Profile; onChange: (p: Partial<Profile>) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/api/v1/profile', {
        notifyHeartbeat:  profile.notifyHeartbeat,
        notifyWebhook:    profile.notifyWebhook,
        notifyStatus:     profile.notifyStatus,
        notifyNewsletter: profile.notifyNewsletter,
      })
      toast('Notification settings saved')
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <Card>
      <SectionTitle>Email Notifications</SectionTitle>
      <SectionDesc>
        Manage the email notifications which you receive from httpSMS. Turn on/off individual
        notifications anytime so you don't get overloaded with emails.
      </SectionDesc>

      <Toggle checked={!!profile.notifyHeartbeat}
        onChange={v => onChange({ notifyHeartbeat: v ? 1 : 0 })}
        label="Heartbeat emails"
        desc="Controls email notifications when we don't receive a heartbeat from your phone for 1 hour." />

      <Toggle checked={!!profile.notifyWebhook}
        onChange={v => onChange({ notifyWebhook: v ? 1 : 0 })}
        label="Webhook and discord emails"
        desc="Controls email notifications when we can't forward events to your discord server or to your webhook." />

      <Toggle checked={!!profile.notifyStatus}
        onChange={v => onChange({ notifyStatus: v ? 1 : 0 })}
        label="Message status emails"
        desc="Controls email notifications when your message is failed or expired." />

      <Toggle checked={!!profile.notifyNewsletter}
        onChange={v => onChange({ notifyNewsletter: v ? 1 : 0 })}
        label="Newsletter emails"
        desc="Controls newsletter emails about new features, updates, and promotions." />

      <Btn variant="primary" onClick={save} disabled={saving}>
        💾 {saving ? 'Saving…' : 'Save Notification Settings'}
      </Btn>
    </Card>
  )
}

// ── Retention section ─────────────────────────────────────────────────────────
function RetentionSection({ profile, onChange }: {
  profile: Profile; onChange: (p: Partial<Profile>) => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/api/v1/profile', { retentionDays: profile.retentionDays })
      toast('Retention period saved')
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <Card>
      <SectionTitle>Message Data Retention</SectionTitle>
      <SectionDesc>
        Your messages are permanently deleted once they exceed the max retention period below,
        counted from when the message was sent or received.
      </SectionDesc>

      <div style={{ maxWidth: 240, marginBottom: 16 }}>
        <Label>Retention Period</Label>
        <Select
          value={profile.retentionDays}
          onChange={e => onChange({ retentionDays: parseInt(e.target.value) })}
        >
          <option value={30}>1 Month</option>
          <option value={90}>3 Months</option>
          <option value={180}>6 Months</option>
          <option value={365}>1 Year</option>
          <option value={730}>2 Years</option>
        </Select>
      </div>

      <Btn variant="primary" size="sm" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Btn>
    </Card>
  )
}

// ── Delete account section ────────────────────────────────────────────────────
function DeleteSection() {
  const toast = useToast()
  const confirm_ = () => {
    if (confirm('Delete ALL data? This cannot be undone.')) {
      toast('Account deletion is disabled in this build', 'error')
    }
  }
  return (
    <Card style={{ borderColor: 'var(--danger)' }}>
      <SectionTitle><span style={{ color: 'var(--danger)' }}>Delete Account</span></SectionTitle>
      <SectionDesc>
        You can delete all your data by clicking the button below. This action is{' '}
        <strong>irreversible</strong> and all your data will be permanently deleted instantly.
      </SectionDesc>
      <Btn variant="danger" onClick={confirm_}>🗑 Delete your Account</Btn>
    </Card>
  )
}

// ── Main Settings page ────────────────────────────────────────────────────────
const defaultProfile: Profile = {
  name: 'Admin', email: '', timezone: 'UTC',
  notifyHeartbeat: 1, notifyWebhook: 1, notifyStatus: 1, notifyNewsletter: 1,
  retentionDays: 365,
}

export default function Settings() {
  const toast = useToast()
  const [profile, setProfile] = useState<Profile>(defaultProfile)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    api.get<Profile>('/api/v1/profile')
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoadingProfile(false))
  }, [])

  const mergeProfile = (patch: Partial<Profile>) =>
    setProfile(p => ({ ...p, ...patch }))

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const updated = await api.patch<Profile>('/api/v1/profile', {
        name: profile.name, email: profile.email, timezone: profile.timezone,
      })
      setProfile(updated)
      toast('Profile saved')
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSavingProfile(false) }
  }

  const timezones = [
    'UTC','Africa/Accra','Africa/Nairobi','Africa/Addis_Ababa',
    'Africa/Lagos','America/New_York','America/Los_Angeles',
    'Europe/London','Europe/Paris','Asia/Dubai','Asia/Kolkata',
    'Asia/Tokyo','Australia/Sydney',
  ]

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>Settings</h1>

      {/* Profile card */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 14,
          }}>
            {(profile.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{profile.name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {profile.email || '—'}
            {profile.email && <span style={{ color: 'var(--primary)' }} title="Verified">✔</span>}
          </div>
        </div>

        {!loadingProfile && (
          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <Label>Display Name</Label>
                <Input value={profile.name} onChange={e => mergeProfile({ name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={profile.email} onChange={e => mergeProfile({ email: e.target.value })} type="email" />
              </div>
              <div>
                <Label>Timezone</Label>
                <Select value={profile.timezone} onChange={e => mergeProfile({ timezone: e.target.value })}>
                  {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </Select>
              </div>
            </div>
            <Btn variant="primary" size="sm" onClick={saveProfile} disabled={savingProfile}
              style={{ marginTop: 16 }}>
              {savingProfile ? 'Saving…' : '💾 Save Profile'}
            </Btn>
          </div>
        )}
      </Card>

      <ApiKeySection />
      <WebhooksSection />
      <NotificationsSection profile={profile} onChange={mergeProfile} />
      <RetentionSection profile={profile} onChange={mergeProfile} />
      <DeleteSection />
    </div>
  )
}
