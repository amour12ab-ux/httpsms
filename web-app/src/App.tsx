import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { getStoredKey, api, Profile } from './api'
import { ToastProvider } from './components/ui'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Messages  from './pages/Messages'
import Phones    from './pages/Phones'
import Settings  from './pages/Settings'
import Login     from './pages/Login'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const key = getStoredKey()
  return key ? <>{children}</> : <Navigate to="/login" replace />
}

function Layout() {
  const [profile, setProfile] = useState({ name: 'Admin', email: '' })
  useEffect(() => {
    api.get<Profile>('/api/v1/profile')
      .then(p => setProfile({ name: p.name, email: p.email }))
      .catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar name={profile.name} email={profile.email} />
      <main style={{
        marginLeft: 220, flex: 1,
        padding: '36px 40px', maxWidth: 920,
      }}>
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/messages" element={<Messages />}  />
          <Route path="/phones"   element={<Phones />}    />
          <Route path="/settings" element={<Settings />}  />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          } />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
