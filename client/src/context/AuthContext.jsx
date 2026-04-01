import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [token, setToken]   = useState(() => localStorage.getItem('jt_token'))
  const [loading, setLoading] = useState(true)

  // Verify token and fetch user profile on mount / token change
  useEffect(() => {
    console.log('🛡️ AuthContext: Checking session...', { hasToken: !!token })
    
    // Failsafe timeout: stop loading after 5 seconds no matter what
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('🛡️ AuthContext: Load timeout reached')
        setLoading(false)
      }
    }, 5000)

    if (!token) {
      console.log('🛡️ AuthContext: No token, done loading')
      setLoading(false)
      clearTimeout(timeout)
      return
    }

    api.get('/auth/me')
      .then(res => {
        console.log('🛡️ AuthContext: User verified', res.data.user.email)
        setUser(res.data.user)
      })
      .catch((err) => {
        console.error('🛡️ AuthContext: Verify failed', err.response?.status)
        localStorage.removeItem('jt_token')
        setToken(null)
      })
      .finally(() => {
        setLoading(false)
        clearTimeout(timeout)
      })
      
    return () => clearTimeout(timeout)
  }, [token])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { token: tk, user: u } = res.data
    localStorage.setItem('jt_token', tk)
    setToken(tk)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (name, email, password, cvText = '', cvFile = null) => {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('email', email)
    formData.append('password', password)
    if (cvText) formData.append('cvText', cvText)
    if (cvFile) formData.append('cvFile', cvFile)

    const res = await api.post('/auth/register', formData)
    const { token: tk, user: u } = res.data
    localStorage.setItem('jt_token', tk)
    setToken(tk)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('jt_token')
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me')
      setUser(res.data.user)
    } catch { /* ignore */ }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, isPremium: !!user?.isPremium, premiumCardsConsumed: user?.premiumCardsConsumed ?? 0, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
