import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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

function PublicLayout({ children }) {
  return (
    <div className="public-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <main style={{ flex: 1 }}>
        {children}
      </main>
      <Footer />
    </div>
  )
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
          <Route path="/pricing" element={<PublicLayout><Pricing /></PublicLayout>} />


            {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
