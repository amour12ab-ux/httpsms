import React from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/',          icon: '⊞', label: 'Dashboard' },
  { to: '/messages',  icon: '✉', label: 'Messages'  },
  { to: '/phones',    icon: '📱', label: 'Phones'    },
  { to: '/settings',  icon: '⚙', label: 'Settings'  },
]

export default function Sidebar({ name, email }: { name: string; email: string }) {
  return (
    <aside style={{
      width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', position: 'fixed',
      height: '100vh', zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '22px 20px', fontSize: 17, fontWeight: 700,
        color: 'var(--accent)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>💬</span> httpSMS
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 0', flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', padding: '6px 18px 4px', textTransform: 'uppercase', letterSpacing: '.1em' }}>
          Navigation
        </div>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 18px', fontSize: 14, textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              background: isActive ? 'rgba(96,165,250,.06)' : 'transparent',
              transition: 'all .15s',
            })}
          >
            <span style={{ width: 18, textAlign: 'center' }}>{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color: '#fff', flexShrink: 0,
          }}>
            {(name || 'A').charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || 'Admin'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email || '—'}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
