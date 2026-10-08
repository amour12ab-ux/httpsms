import React, { useEffect, useState } from 'react'
import { api, OutMsg, InMsg } from '../api'
import { Card, Table, TR, TD, Badge, Btn, Spinner, Empty } from '../components/ui'

type Tab = 'outbound' | 'inbound'

export default function Messages() {
  const [tab, setTab]         = useState<Tab>('outbound')
  const [outbound, setOutbound] = useState<OutMsg[]>([])
  const [inbound, setInbound]   = useState<InMsg[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    if (tab === 'outbound') {
      api.get<{ messages: OutMsg[] }>('/api/v1/messages?limit=50')
        .then(d => setOutbound(d.messages)).finally(() => setLoading(false))
    } else {
      api.get<{ messages: InMsg[] }>('/api/v1/incoming?limit=50')
        .then(d => setInbound(d.messages)).finally(() => setLoading(false))
    }
  }, [tab])

  const fmt = (dt: string) => {
    try { return new Date(dt).toLocaleString() } catch { return dt }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Messages</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['outbound','inbound'] as Tab[]).map(t => (
          <Btn key={t} variant={tab===t ? 'primary' : 'outline'} size="sm"
            onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Btn>
        ))}
      </div>

      <Card style={{ padding: 0 }}>
        {loading ? <Spinner /> : tab === 'outbound' ? (
          outbound.length === 0 ? <Empty text="No outbound messages" /> :
          <Table heads={['RECIPIENT','MESSAGE','STATUS','DATE']}>
            {outbound.map(m => (
              <TR key={m.id}>
                <TD mono>{m.recipient}</TD>
                <TD><span style={{ display:'block', maxWidth:320, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.body}</span></TD>
                <TD><Badge status={m.status} /></TD>
                <TD muted>{fmt(m.createdAt)}</TD>
              </TR>
            ))}
          </Table>
        ) : (
          inbound.length === 0 ? <Empty text="No inbound messages" /> :
          <Table heads={['FROM','MESSAGE','WEBHOOK','DATE']}>
            {inbound.map(m => (
              <TR key={m.id}>
                <TD mono>{m.sender}</TD>
                <TD><span style={{ display:'block', maxWidth:320, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.body}</span></TD>
                <TD><Badge status={m.webhookStatus} /></TD>
                <TD muted>{fmt(m.receivedAt)}</TD>
              </TR>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
