import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ── Toast ─────────────────────────────────────────────────────────────────────
interface ToastMsg { id: number; msg: string; type: 'success' | 'error' }
const ToastCtx = createContext<(msg: string, type?: 'success' | 'error') => void>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const push = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background:'var(--surface2)', border:`1px solid var(--border)`,
            borderLeft: `3px solid ${t.type==='success' ? 'var(--success)' : 'var(--danger)'}`,
            borderRadius:8, padding:'12px 16px', fontSize:13, display:'flex',
            alignItems:'center', gap:10, minWidth:240,
            animation:'slideIn .2s ease'
          }}>
            <span>{t.type==='success' ? '✓' : '✗'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'outline' | 'danger' | 'ghost' | 'warning'
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: 'sm' | 'md'
}
const btnStyle = (v: BtnVariant, size: 'sm'|'md', disabled?: boolean): React.CSSProperties => {
  const base: React.CSSProperties = {
    display:'inline-flex', alignItems:'center', gap:6,
    padding: size==='sm' ? '5px 12px' : '9px 16px',
    borderRadius:7, fontSize: size==='sm' ? 13 : 14,
    fontWeight:500, border:'1px solid transparent',
    opacity: disabled ? 0.5 : 1, transition:'all .15s',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
  const map: Record<BtnVariant, React.CSSProperties> = {
    primary: { background:'var(--primary)', color:'#fff', borderColor:'var(--primary)' },
    outline: { background:'transparent', color:'var(--text)', borderColor:'var(--border)' },
    danger:  { background:'transparent', color:'var(--danger)', borderColor:'var(--danger)' },
    ghost:   { background:'transparent', color:'var(--muted)', borderColor:'transparent' },
    warning: { background:'transparent', color:'var(--warning)', borderColor:'var(--border)' },
  }
  return { ...base, ...map[v] }
}
export function Btn({ variant='outline', size='md', style, children, ...rest }: BtnProps) {
  return (
    <button style={{ ...btnStyle(variant, size, rest.disabled), ...style }} {...rest}>
      {children}
    </button>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:10, padding:24, marginBottom:24, ...style
    }}>
      {children}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} style={{
      width:'100%', background:'#0d1117', border:'1px solid var(--border)',
      color:'var(--text)', padding:'9px 13px', borderRadius:7, fontSize:14, outline:'none',
      ...props.style
    }} />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{
      width:'100%', background:'#0d1117', border:'1px solid var(--border)',
      color:'var(--text)', padding:'9px 13px', borderRadius:7, fontSize:14, outline:'none',
      appearance:'none', cursor:'pointer',
      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
      backgroundRepeat:'no-repeat', backgroundPosition:'right 12px center', paddingRight:36,
      ...props.style
    }} />
  )
}

// ── Label ─────────────────────────────────────────────────────────────────────
export function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>{children}</div>
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const badgeColors: Record<string, [string,string]> = {
  sent:      ['#1e3a5f','#60a5fa'], delivered: ['#14532d','#4ade80'],
  failed:    ['#450a0a','#f87171'], queued:    ['#1c1c1c','#94a3b8'],
  pending:   ['#1c1c1c','#94a3b8'], online:    ['#14532d','#4ade80'],
  offline:   ['#1c1c1c','#94a3b8'], credited:  ['#14532d','#4ade80'],
}
export function Badge({ status }: { status: string }) {
  const [bg, fg] = badgeColors[status] || ['#1c1c1c','#94a3b8']
  return (
    <span style={{
      background: bg, color: fg, padding:'2px 10px',
      borderRadius:20, fontSize:12, fontWeight:500
    }}>{status}</span>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string
}) {
  return (
    <div style={{ display:'flex', gap:14, marginBottom:20 }}>
      <div style={{ flexShrink:0, marginTop:2 }}>
        <div
          onClick={() => onChange(!checked)}
          style={{
            width:44, height:24, borderRadius:12, cursor:'pointer', position:'relative',
            background: checked ? 'var(--primary)' : 'var(--border)', transition:'.2s'
          }}
        >
          <div style={{
            position:'absolute', width:18, height:18, borderRadius:'50%',
            background:'white', top:3, left: checked ? 23 : 3, transition:'.2s'
          }} />
        </div>
      </div>
      <div>
        <div style={{ fontWeight:600, marginBottom:3 }}>{label}</div>
        {desc && <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.5 }}>{desc}</div>}
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
        <thead>
          <tr>
            {heads.map(h => (
              <th key={h} style={{
                textAlign:'left', padding:'10px 14px',
                fontSize:11, textTransform:'uppercase', letterSpacing:'.08em',
                color:'var(--muted)', borderBottom:'1px solid var(--border)'
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
export function TR({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? 'rgba(255,255,255,.02)' : 'transparent' }}
    >
      {children}
    </tr>
  )
}
export function TD({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return (
    <td style={{
      padding:'12px 14px', borderBottom:'1px solid var(--border)',
      fontFamily: mono ? 'var(--mono)' : undefined,
      color: muted ? 'var(--muted)' : undefined,
      verticalAlign:'middle'
    }}>{children}</td>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>{children}</h2>
}
export function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p style={{ color:'var(--muted)', fontSize:14, marginBottom:20, lineHeight:1.6 }}>{children}</p>
}
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background:'rgba(255,255,255,.08)', padding:'2px 6px',
      borderRadius:4, fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)'
    }}>{children}</code>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.7)',
      zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:10, padding:32, maxWidth:420, width:'90%'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:18, fontWeight:700 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ text = 'Nothing here yet' }: { text?: string }) {
  return (
    <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:14 }}>{text}</div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>
      Loading…
    </div>
  )
}
