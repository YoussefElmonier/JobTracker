import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UpgradeModal from '../components/UpgradeModal'
import api from '../api/axios'
import { RiUpload2Line, RiCheckLine, RiShareBoxLine } from 'react-icons/ri'
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
  const [isSubscribed, setIsSubscribed] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()

  // Platform detection — used to tailor the notification subscribe experience
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    if (user?.cvText) {
      setCvText(user.cvText)
    }
    if (new URLSearchParams(location.search).get('gmail') === 'success') {
      setMessage('✅ Gmail connected successfully!')
      refreshUser()
      navigate('/profile', { replace: true })
    }
    checkSubscription()
  }, [user, location, navigate])

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
    } catch (err) {
      console.error('Error checking subscription:', err)
    }
  }

  const handleTextChange = (e) => {
    setCvText(e.target.value.slice(0, 3000))
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
    const token = localStorage.getItem('jt_token')
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    window.location.href = `${serverUrl}/api/auth/google/gmail?token=${token}`
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

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  };

  const handleEnableNotifications = async () => {
    const topic = user?.ntfyTopic;
    if (!topic || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return setError('Feature not supported on this browser.');
    }

    try {
      setLoading(true);
      const reg = await navigator.serviceWorker.ready;
      
      // Real VAPID Public Key for ntfy.sh public server
      const vapidPublicKey = 'BEMjM0sNxh41x0a6Lz3YaqkJ7AUhZefxsOQgw-at69i0fM1CybVBcj7-QQXf4N_tPCgFnOXdRbQ5jrSrr9Yg9Lc';
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Prepare the exact payload required by ntfy.sh v1/webpush
      const subJSON = subscription.toJSON();
      const payload = {
        endpoint: subJSON.endpoint,
        auth:     subJSON.keys.auth,
        p256dh:   subJSON.keys.p256dh,
        topics:   [topic] // Mandatory for ntfy to link the topic
      };

      // Send the subscription to ntfy.sh backend silently
      const ntfyWebPushUrl = 'https://ntfy.sh/v1/webpush';
      const res = await fetch(ntfyWebPushUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) throw new Error('Subscription failed at ntfy.sh');

      setIsSubscribed(true);
      setMessage('🚀 Success! Notifications enabled inside TRKR.');
    } catch (err) {
      console.error('Subscription error:', err);
      setError('Failed to enable background notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    try {
      setLoading(true);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      
      if (sub) {
        await sub.unsubscribe();
        // Also tell ntfy to remove it (optional but good practice)
        try {
          await fetch('https://ntfy.sh/v1/webpush', {
            method: 'POST',
            body: JSON.stringify({
              endpoint: sub.endpoint,
              auth:     sub.toJSON().keys.auth,
              p256dh:   sub.toJSON().keys.p256dh,
              topics:   [] // Empty topics removes the subscription from ntfy
            }),
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.warn('Failed to unregister at ntfy side (non-fatal)', e);
        }
      }
      
      setIsSubscribed(false);
      setMessage('Notifications disabled.');
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError('Failed to disable notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPush = async () => {
    try {
        setLoading(true);
        const topic = user?.ntfyTopic;
        if (!topic) return;
        
        await api.post('/auth/test-push', { topic });
        setMessage('📬 Test push sent! Check your phone.');
    } catch (err) {
        setError('Manual test failed.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <div className="page-container animate-fade">
        <div className="profile__header" style={{ marginBottom: '24px' }}>
          <h1 className="page-title">My Profile</h1>
        </div>

        <div className="profile__content">
          {/* ── User Details ── */}
          <section className="profile__section">
            <h2>User Details</h2>
            <div className="profile__user-info">
              <p><strong>Name:</strong> {user?.name}</p>
              <p><strong>Email:</strong> {user?.email}</p>
            </div>
          </section>

          {/* ── CV Section ── */}
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
                <label className="profile__action-btn">
                  {file ? (
                    <span>{file.name} (Ready)</span>
                  ) : (
                    <span>Choose PDF CV</span>
                  )}
                  <input type="file" id="cv-upload-input" accept="application/pdf" onChange={handleFileChange} />
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
                  {cvText.length} / 3000 characters
                </div>
              </div>

              {error && <div className="profile__error">{error}</div>}
              {message && <div className="profile__success">{message}</div>}

              <button type="submit" className="profile__action-btn" disabled={loading || (!cvText && !file)}>
                {loading ? 'Saving...' : 'Save CV'}
              </button>
            </form>
          </section>

          {/* ── Gmail Integration ── */}
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
                        position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
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

          {/* ── Mobile Alerts Card ── */}
          <section
            className="profile__section profile__alerts-section"
            style={{ marginTop: '24px', position: 'relative', overflow: 'hidden' }}
          >
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔔 Mobile Alerts
              {!user?.isPremium && (
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', textTransform: 'uppercase' }}>
                  👑 Premium
                </span>
              )}
            </h2>

            {user?.isPremium ? (
              /* Premium view */
              <div style={{ marginTop: '16px' }}>
                <p style={{ marginBottom: '8px', color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6' }}>
                  Get real-time push notifications the moment TRKR detects a job offer in your inbox.
                </p>

                {/* Requirement Note — Important for Web Push reliability */}
                {!isStandalone && (
                  <div style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    background: '#fffbeb', // Light amber
                    border: '1px solid #fde68a',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: '#92400e',
                    lineHeight: '1.6',
                  }}>
                    <strong style={{ color: '#78350f' }}>⚠️ Action Required:</strong> To receive background notifications, you must first <strong>&ldquo;Add to Home Screen&rdquo;</strong> and open TRKR from your phone's home screen.
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', marginBottom: '16px' }}>
                  {isSubscribed ? (
                    <button
                      type="button"
                      onClick={handleDisableNotifications}
                      className="profile__save-btn"
                      style={{ 
                        background: '#fff1f2',
                        color: '#e11d48',
                        border: '1px solid #fecdd3',
                        boxShadow: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Disabling...' : <>🔴 Disable Notifications</>}
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="enable-notifications-btn"
                      onClick={handleEnableNotifications}
                      className="profile__save-btn"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '6px' 
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Enabling...' : <>🔔 Enable Notifications</>}
                    </button>
                  )}

                  {user?.isPremium && isSubscribed && (
                    <button 
                        type="button"
                        onClick={handleTestPush}
                        className="btn-ghost"
                        style={{ 
                          fontSize: '13px', 
                          color: 'var(--accent)', 
                          textDecoration: 'none', 
                          padding: '8px', 
                          textAlign: 'center',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          marginTop: '4px'
                        }}
                    >
                        ⚡ Send verify alert
                    </button>
                  )}
                </div>

                {error && <div className="profile__error" style={{ marginBottom: '16px' }}>{error}</div>}
                {message && <div className="profile__success" style={{ marginBottom: '16px' }}>{message}</div>}

                {/* iOS PWA install hint — only shown in Safari when NOT already on home screen */}
                {isIOS && !isStandalone && (
                  <div style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: '10px',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    lineHeight: '1.6',
                  }}>
                    <strong style={{ color: 'var(--text-main)' }}>📲 iPhone User?</strong>{' '}
                    To receive alerts, tap the{' '}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <strong style={{ color: 'var(--text-main)' }}>Share</strong>{' '}
                      <RiShareBoxLine className="animate-bounce-slow" style={{ color: 'var(--accent)', fontSize: '1.1rem' }} />
                    </span>{' '}
                    icon in Safari and select{' '}
                    <strong style={{ color: 'var(--text-main)' }}>&ldquo;Add to Home Screen&rdquo;</strong>.
                    Then open TRKR from your home screen and subscribe.
                  </div>
                )}

                <div style={{
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.7',
                }}>
                  <p style={{ margin: 0 }}>
                    📱 <strong style={{ color: 'var(--text-main)' }}>Background Push:</strong> TRKR uses the official Web Push API. Stay notified even when the app is closed.
                  </p>
                  <p style={{ margin: '6px 0 0' }}>
                    🤖 <strong style={{ color: 'var(--text-main)' }}>Reliability:</strong> For the best experience on old Android devices, download the{' '}
                    <a
                      href="https://ntfy.sh"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      ntfy app
                    </a>.
                  </p>
                </div>
              </div>
            ) : (
              /* Free user — blurred lock overlay */
              <div style={{ position: 'relative' }}>
                {/* Blurred preview */}
                <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', marginTop: '16px' }}>
                  <p style={{ marginBottom: '8px', color: 'var(--text-muted)', fontSize: '15px' }}>
                    Get real-time push notifications the moment TRKR detects a job offer in your inbox.
                  </p>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', background: 'var(--accent)', color: '#fff',
                    borderRadius: '999px', fontWeight: '500', fontSize: '0.9rem',
                    marginTop: '12px', marginBottom: '16px',
                  }}>
                    🔔 Enable Notifications
                  </div>
                  <div style={{
                    background: 'var(--bg-page)', border: '1px solid var(--border)',
                    borderRadius: '10px', padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)',
                  }}>
                    <p style={{ margin: 0 }}>📱 iPhone / Desktop: No app needed.</p>
                    <p style={{ margin: '6px 0 0' }}>🤖 Android: Download the ntfy app for the best experience.</p>
                  </div>
                </div>

                {/* Overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '12px', zIndex: 2,
                }}>
                  <div style={{ fontSize: '2rem' }}>🔒</div>
                  <button
                    id="upgrade-for-alerts-btn"
                    onClick={() => setShowUpgrade(true)}
                    style={{
                      padding: '10px 22px',
                      background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '999px',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(239,68,68,0.4)'
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(239,68,68,0.35)'
                    }}
                  >
                    🚀 Upgrade to Premium
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {showUpgrade && <UpgradeModal reason="premium" onClose={() => setShowUpgrade(false)} />}
      </div>
    </PageWrapper>
  )
}
