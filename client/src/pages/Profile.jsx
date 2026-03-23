import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UpgradeModal from '../components/UpgradeModal'
import api from '../api/axios'
import { RiUpload2Line, RiCheckLine } from 'react-icons/ri'
import PageWrapper from '../components/PageWrapper'
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
    // Check for premium status first (existing logic preserved)
    if (!user?.isPremium) {
      setShowUpgrade(true);
      return;
    }

    const token = localStorage.getItem('jt_token') ||
                  localStorage.getItem('token') ||
                  localStorage.getItem('jwt') ||
                  localStorage.getItem('authToken') ||
                  sessionStorage.getItem('token');

    if (!token) {
      console.error('No token found in storage');
      alert('Please log in again before connecting Gmail');
      return;
    }

    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google/gmail?token=${token}`;
  };

  const handleDisconnectGmail = async () => {
    try {
      await api.post('/auth/gmail/disconnect')
      await refreshUser()
      setMessage('Gmail disconnected.')
    } catch (err) {
      setError('Failed to disconnect Gmail')
    }
  }

  const handleToggleTracking = async () => {
    try {
      const newValue = !(user?.autoTrackEmails !== false)
      await api.put('/auth/gmail/toggle', { autoTrackEmails: newValue })
      await refreshUser()
      setMessage(`Auto-tracking ${newValue ? 'enabled' : 'disabled'}.`)
    } catch (err) {
      setError('Failed to toggle tracking')
    }
  }

  return (
    <PageWrapper>
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
                <label className="form-label" style={{ marginBottom: '12px' }}>Update PDF CV:</label>
                <label className="custom-file-upload">
                  {file ? (
                    <>
                      <RiCheckLine className="file-upload-icon" style={{ color: '#10b981' }} />
                      <span style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{file.name}</span>
                    </>
                  ) : (
                    <>
                      <RiUpload2Line className="file-upload-icon" />
                      <span>Choose PDF File</span>
                    </>
                  )}
                  <input type="file" accept="application/pdf" onChange={handleFileChange} />
                </label>
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
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Gmail Integration
              {!user?.isPremium && (
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', textTransform: 'uppercase' }}>
                  👑 Premium
                </span>
              )}
            </h2>
            {user?.gmailConnected ? (
              <div style={{ marginTop: '16px' }}>
                <p style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '16px' }}>
                  ✅ Gmail connected
                </p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', background: 'var(--surface-color)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Auto-track email updates</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Automatically read recruiter emails and update job card statuses.</span>
                  </div>
                  <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                    <input 
                      type="checkbox" 
                      checked={user?.autoTrackEmails !== false} 
                      onChange={handleToggleTracking}
                      style={{ opacity: 0, width: 0, height: 0 }} 
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: (user?.autoTrackEmails !== false) ? '#10b981' : '#ccc', transition: '.4s', borderRadius: '24px'
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                        transform: (user?.autoTrackEmails !== false) ? 'translateX(20px)' : 'translateX(0)'
                      }} />
                    </span>
                  </label>
                </div>

                <button onClick={handleDisconnectGmail} className="btn" style={{ background: '#fce7f3', color: '#be185d', border: 'none' }}>
                  Disconnect Gmail
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '16px' }}>
                <p style={{ marginBottom: '16px', color: '#4b5563', fontSize: '15px' }}>
                  Connect your Gmail to allow TRKR to automatically read recruiter emails and update your job applications accordingly.
                </p>
                
                <button 
                  onClick={handleConnectGmail} 
                  className="btn" 
                  style={{ 
                    background: !user?.isPremium ? '#f3f4f6' : 'var(--accent)',
                    color: !user?.isPremium ? '#9ca3af' : '#fff',
                    border: !user?.isPremium ? '1px solid #e5e7eb' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center',
                    width: 'fit-content'
                  }}
                >
                  {!user?.isPremium && <span style={{ fontSize: '1.1rem' }}>👑</span>}
                  Connect Gmail to auto-track recruiter emails
                </button>

                {!user?.isPremium ? (
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '12px' }}>
                    Auto-detect interviews, offers and rejections from your inbox — Premium feature
                  </p>
                ) : (
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '12px' }}>
                      ✅ Ready to connect
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {showUpgrade && <UpgradeModal reason="premium" onClose={() => setShowUpgrade(false)} />}
      </div>
    </PageWrapper>
  )
}
