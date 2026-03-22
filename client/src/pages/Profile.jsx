import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UpgradeModal from '../components/UpgradeModal'
import api from '../api/axios'
import './Profile.css'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [cvText, setCvText] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.cvText) {
      setCvText(user.cvText)
    }
    if (new URLSearchParams(location.search).get('gmail') === 'success') {
      setMessage('✅ Gmail connected successfully!')
      refreshUser()
      // Clean url
      navigate('/profile', { replace: true })
    }
  }, [user, location, navigate])

  const handleTextChange = (e) => {
    setCvText(e.target.value.slice(0, 2000))
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (file) {
        const formData = new FormData()
        formData.append('cvFile', file)
        const res = await api.put('/auth/profile/cv', formData)
        setMessage(res.data.message)
        setCvText(res.data.cvText || '')
        setFile(null)
      } else {
        const res = await api.put('/auth/profile/cv', { cvText })
        setMessage(res.data.message)
        setCvText(res.data.cvText || '')
      }
      await refreshUser()
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.message || 'Failed to save CV')
    } finally {
      setLoading(false)
    }
  }

  const handleConnectGmail = () => {
    if (!user?.isPremium) {
      setShowUpgrade(true)
      return
    }
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    window.location.href = `${serverUrl}/api/auth/google/gmail`
  }

  const handleDisconnectGmail = async () => {
    try {
      await api.post('/auth/gmail/disconnect')
      await refreshUser()
      setMessage('Gmail disconnected.')
    } catch (err) {
      setError('Failed to disconnect Gmail')
    }
  }

  return (
    <div className="page-container animate-fade">
      <div className="profile__header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title">My Profile</h1>
      </div>

      <div className="profile__content">
        <section className="profile__section">
          <h2>User Details</h2>
          <div className="profile__user-info">
            <p><strong>Name:</strong> {user?.name}</p>
            <p><strong>Email:</strong> {user?.email}</p>
          </div>
        </section>

        <section className="profile__section profile__cv-section">
          <h2>My CV</h2>
          {!user?.cvText ? (
            <p className="profile__cv-warning">Upload your CV to get personalized cover letters</p>
          ) : (
            <p className="profile__cv-warning">You can update your CV anytime — just overwrites the existing one.</p>
          )}

          <form onSubmit={handleSubmit} className="profile__cv-form">
            <div className="profile__cv-upload">
              <label>Upload a PDF CV:</label>
              <input type="file" accept="application/pdf" onChange={handleFileChange} />
            </div>
            
            <div className="profile__cv-divider">OR</div>

            <div className="profile__cv-textarea-wrapper">
              <label>Paste CV Text:</label>
              <textarea 
                value={cvText}
                onChange={handleTextChange}
                placeholder="Paste your CV text here..."
                rows={10}
              />
              <div className="profile__cv-counter">
                {cvText.length} / 2000 characters
              </div>
            </div>

            {error && <div className="profile__error">{error}</div>}
            {message && <div className="profile__success">{message}</div>}

            <button type="submit" className="profile__save-btn" disabled={loading || (!cvText && !file)}>
              {loading ? 'Saving...' : 'Save CV'}
            </button>
          </form>
        </section>

        <section className="profile__section profile__gmail-section" style={{ marginTop: '24px' }}>
          <h2>Gmail Integration</h2>
          {user?.gmailConnected ? (
            <div style={{ marginTop: '16px' }}>
              <p style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '16px' }}>✅ Gmail connected — we'll auto-update your job statuses.</p>
              <button onClick={handleDisconnectGmail} className="btn" style={{ background: '#fce7f3', color: '#be185d', border: 'none' }}>
                Disconnect Gmail
              </button>
            </div>
          ) : (
            <div style={{ marginTop: '16px' }}>
              <p style={{ marginBottom: '16px', color: '#4b5563' }}>Connect your Gmail to allow TRKR to automatically read recruiter emails and update your job applications accordingly.</p>
              <button onClick={handleConnectGmail} className="btn btn-primary">
                Connect Gmail to auto-track recruiter emails
              </button>
              {!user?.isPremium && (
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#f59e0b' }}>⭐</span> Premium Feature
                  </p>
              )}
            </div>
          )}
        </section>
      </div>

      {showUpgrade && <UpgradeModal reason="premium" onClose={() => setShowUpgrade(false)} />}
    </div>
  )
}
