import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

// Pages
import Landing   from './pages/Landing'
import Login     from './pages/Login'
import Register  from './pages/Register'
import Dashboard from './pages/Dashboard'
import Kanban    from './pages/Kanban'
import Reminders from './pages/Reminders'
import Profile   from './pages/Profile'
import Pricing   from './pages/Pricing'
import Terms     from './pages/Terms'
import Privacy   from './pages/Privacy'
import Refund    from './pages/Refund'

import logoLight from './assets/logo-light.png'
import logoDark from './assets/logo-dark.png'
import { useTheme } from './context/ThemeContext'
import { RiArrowLeftLine } from 'react-icons/ri'

function AuthenticatedLayout({ children }) {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
      <Footer />
    </div>
  )
}

function PublicLayout({ children, showSimpleNav }) {
  const { theme } = useTheme()
  return (
    <div className="public-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {showSimpleNav && (
        <nav className="simple-nav" style={{ 
          padding: '1rem 2rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => window.location.href='/'}>
            <img src={theme === 'light' ? logoLight : logoDark} alt="trkr" style={{ height: '24px' }} />
          </div>
          <a href="/" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            color: 'var(--text-main)', 
            textDecoration: 'none',
            fontSize: 'var(--font-sm)',
            fontWeight: 500
          }}>
            <RiArrowLeftLine /> Back to Home
          </a>
        </nav>
      )}
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <Footer />
    </div>
  )
}

function PricingPage() {
  const { user } = useAuth()
  if (user) {
    return <AuthenticatedLayout><Pricing /></AuthenticatedLayout>
  }
  return <PublicLayout showSimpleNav><Pricing /></PublicLayout>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
          {/* Public */}
          <Route path="/"         element={<Landing />} />
          <Route path="/login"    element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
          <Route path="/terms"    element={<PublicLayout><Terms /></PublicLayout>} />
          <Route path="/privacy"  element={<PublicLayout><Privacy /></PublicLayout>} />
          <Route path="/refund"   element={<PublicLayout><Refund /></PublicLayout>} />

          {/* Protected */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <Dashboard />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />
          <Route path="/kanban" element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <Kanban />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />
          <Route path="/reminders" element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <Reminders />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <Profile />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
