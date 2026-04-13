import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UpgradeModal from '../components/UpgradeModal'
import api from '../api/axios'
import { 
  RiUpload2Line, RiCheckLine, RiShareBoxLine, RiSparklingLine, 
  RiInformationLine, RiDownloadLine, RiFileCopyLine, RiErrorWarningLine 
} from 'react-icons/ri'
import jsPDF from 'jspdf'

import PageWrapper from '../components/PageWrapper'
import './Profile.css'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [cvText, setCvText] = useState('')
  const [file, setFile] = useState(null)
  const [saveLoading, setSaveLoading] = useState(false);
  const [enableLoading, setEnableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertError, setAlertError] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState(null);
  const [message, setMessage] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false)
  
  // ATS Optimization States
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsResult, setAtsResult] = useState(null)
  const [atsError, setAtsError] = useState(null)


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
  }, [user, location, navigate])

  const handleTextChange = (e) => {
    setCvText(e.target.value.slice(0, 4000))
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
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

  const handleToggleNotifications = async (enable) => {
    setAlertError(null);
    setAlertMessage(null);

    try {
        setEnableLoading(true);

        if (enable) {
          // Enable Logic
          if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
              setAlertError('Push notifications are not supported on this browser/device.');
              setEnableLoading(false);
              return;
          }

          const reg = await navigator.serviceWorker.ready;
          
          // Desktop browsers usually strictly require an explicit permission request 
          // before pushManager.subscribe will succeed without a 'push service error'.
          if (Notification.permission === 'default') {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') {
               setAlertError('Permission was not granted. Please allow notifications.');
               setEnableLoading(false);
               return;
            }
          }

          if (Notification.permission === 'denied') {
            setAlertError('Please enable notifications in your browser/device settings to continue.');
            setEnableLoading(false);
            return;
          }

          // Cleanup stale subscriptions
          const oldSub = await reg.pushManager.getSubscription();
          if (oldSub) await oldSub.unsubscribe();

          // TRKR Native VAPID Public Key
          const vapidPublicKey = 'BIYildETI2nVN7bLjBlDRU0RNjHBY8yn6Q_lLAo0RG458hUvt0Q6J87reTfCRseFlUbrKDPg0UYfP4gxkvxVrSU';
          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

          let subscription;
          try {
            subscription = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey
            });
          } catch (subErr) {
            console.error('pushManager.subscribe failed:', subErr);
            setAlertError(`Subscribe failed: ${subErr.message}`);
            setEnableLoading(false);
            return;
          }

          // Send subscription to TRKR Backend natively
          const res = await api.post('/auth/push/subscribe', {
            subscription: subscription
          });

          if (res.status !== 200) {
            setAlertError('Failed to save your alert channel. Trying again later.');
            setEnableLoading(false);
            return;
          }

          setAlertMessage('🚀 Success! Native Mobile Alerts enabled!');
        } else {
          // Disable Logic
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
          }
          
          const res = await api.post('/auth/push/unsubscribe');
          if (res.status === 200) {
            setAlertMessage('Notifications gracefully disabled.');
          } else {
            setAlertError('Failed to disable on server, but device was unsubscribed.');
          }
        }
    } catch (err) {
      console.error('Toggle notification error:', err);
      setAlertError(`Failed: ${err.message}`);
    } finally {
      setEnableLoading(false);
      await refreshUser();
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
        setSaveLoading(true);
        setError(null);
        setMessage(null);
        const formData = new FormData();
        formData.append('cvText', cvText);
        if (file) {
            formData.append('cvFile', file);
        }
        await api.put('/auth/profile/cv', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        setMessage('CV updated successfully!');
    } catch (err) {
        setError('Failed to update CV.');
    } finally {
        setSaveLoading(false);
    }
  };

  const handleTestPush = async (e) => {
    if (e) e.preventDefault();
    try {
        setTestLoading(true);
        setTestError(null);
        
        await api.post('/auth/test-push');
        setAlertMessage('📬 Test push sent! Check your phone.');
    } catch (err) {
        setTestError('Manual test failed.');
    } finally {
        setTestLoading(false);
    }
  };

  const handleOptimizeCV = async () => {
    try {
      setAtsLoading(true)
      setAtsError(null)
      const formData = new FormData()
      if (file) {
        formData.append('cvFile', file)
      }
      formData.append('manualText', cvText)

      const res = await api.post('/cv/optimize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setAtsResult(res.data)
      await refreshUser()
    } catch (err) {
      if (err.response?.data?.error === 'limit_reached') {
        setShowUpgrade(true)
      } else {
        setAtsError(err.response?.data?.message || 'Failed to optimize CV.')
      }
    } finally {
      setAtsLoading(false)
    }
  }

  const handleDownloadCV = () => {
    if (!atsResult?.cv) return
    const doc = new jsPDF()
    
    // Clean markdown first
    const cleanText = atsResult.cv
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
      .replace(/\*\*([^*]+)\*\*/g, '$1')       // **bold** -> bold
      .replace(/#{1,6}\s+/g, '')               // # Header -> Header

    const lines = cleanText.split('\n')
    let y = 20
    const margin = 20
    const pageWidth = doc.internal.pageSize.width
    const contentWidth = pageWidth - (margin * 2)

    doc.setFont('Helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)

    lines.forEach((line) => {
      // Logic for headers: All caps lines or specific sections
      const isHeader = /^[A-Z\s]{4,}$/.test(line.trim()) || 
                      ['EXPERIENCE', 'SUMMARY', 'SKILLS', 'EDUCATION', 'PROJECTS'].some(h => line.toUpperCase().includes(h))
      
      if (isHeader) {
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(33, 33, 33)
        y += 5
      } else {
        doc.setFont('Helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
      }

      // Check if line needs wrapping
      const wrappedLines = doc.splitTextToSize(line, contentWidth)
      
      wrappedLines.forEach((wLine) => {
        if (y > 280) { // Page break
          doc.addPage()
          y = 20
        }
        doc.text(wLine, margin, y)
        y += 6
      })

      if (isHeader) y += 2
    })

    doc.save(`${user?.name || 'My'}_Optimized_CV.pdf`)
  }


  const handleCopyCV = () => {
    if (atsResult?.cv) {
      navigator.clipboard.writeText(atsResult.cv)
    }
  }


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

            <form onSubmit={handleUpdateProfile} className="profile__cv-form">
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
                  {cvText.length} / 4000 characters
                </div>
              </div>

              {error && <div className="profile__error">{error}</div>}
              {message && <div className="profile__success">{message}</div>}

              <button 
              type="submit" 
              className="profile__save-btn" 
              disabled={saveLoading}
            >
              {saveLoading ? 'Saving...' : 'Save CV'}
            </button>
            </form>
          </section>
          
          {/* ── ATS CV Optimizer Section ── */}
          <section className="profile__section profile__ats-section" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <RiSparklingLine style={{ color: 'var(--accent)' }} /> ATS CV Optimizer
              </h2>
              <span style={{ 
                fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px', borderRadius: '12px',
                background: 'var(--bg-page)', border: '1px solid var(--border)', color: 'var(--text-muted)'
              }}>
                {user?.atsOptimizationsUsed || 0} / {user?.isPremium ? '∞' : '2'} optimizations used
              </span>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Transform your experience into an ATS-friendly resume that gets past automated filters.
            </p>

            {atsLoading ? (
              <div className="shimmer-container" style={{ minHeight: '150px', background: 'var(--bg-page)', borderRadius: '12px', marginBottom: '20px' }}>
                <div className="typewriter-text" style={{ color: 'var(--text-main)' }}>AI is optimizing your CV...</div>
                <div className="shimmer-line" style={{ width: '100%' }}></div>
                <div className="shimmer-line" style={{ width: '90%' }}></div>
                <div className="shimmer-line" style={{ width: '40%' }}></div>
              </div>
            ) : atsResult ? (
              <div className="ats-result" style={{ background: 'var(--bg-page)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', marginBottom: '20px' }}>
                {atsResult.insufficient ? (
                  <div className="ats-warning">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', fontWeight: 600, marginBottom: '12px' }}>
                      <RiErrorWarningLine /> More Information Needed
                    </div>
                    <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>The AI needs more details to generate a professional CV. Please include:</p>
                    <ul style={{ listStyle: 'disc', paddingLeft: '20px', fontSize: '0.85rem' }}>
                      {atsResult.missing?.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-glow)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 700
                        }}>
                          {atsResult.score}%
                        </div>
                        <span style={{ fontWeight: 600 }}>ATS Score</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" onClick={handleCopyCV} title="Copy Content"><RiFileCopyLine /></button>
                        <button className="btn-icon" onClick={handleDownloadCV} title="Download PDF"><RiDownloadLine /></button>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RiCheckLine style={{ color: '#10b981' }} /> Key Improvements:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {atsResult.improvements?.map((imp, i) => (
                          <span key={i} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(16,185,129,0.1)', color: '#059669', borderRadius: '4px' }}>
                            {imp}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="cv-preview">
                      {atsResult.cv}
                    </div>
                  </>
                )}
                <button 
                  className="btn-ghost" 
                  style={{ marginTop: '20px', width: '100%', fontSize: '0.8rem', color: 'var(--text-muted)' }} 
                  onClick={() => setAtsResult(null)}
                >
                  Start Over
                </button>
              </div>

            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {atsError && <div className="profile__error" style={{ margin: 0 }}>{atsError}</div>}
                <button 
                  className="profile__save-btn" 
                  onClick={handleOptimizeCV}
                  style={{ 
                    background: 'var(--text-main)', 
                    color: 'var(--bg-page)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px' 
                  }}
                >
                  <RiSparklingLine /> Optimize & Make ATS-Friendly
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  <RiInformationLine /> This will analyze your current CV/Text and reformat it for recruiter software.
                </p>
              </div>
            )}
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
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>We scan your inbox (last 7 days) for application receipts, interview invites, and offers to keep your board synced.</span>
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
                  Connect your Gmail to allow TRKR to automatically sync your job search. We'll monitor your inbox for new applications and status updates from recruiters.
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', background: 'var(--surface-color)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Native Mobile Alerts</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {enableLoading ? 'Updating status...' : user?.pushSubscription ? 'Notifications are active on this device.' : 'Enable background push notifications.'}
                    </span>
                  </div>
                  <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                    <input
                      type="checkbox"
                      checked={!!user?.pushSubscription}
                      onChange={(e) => handleToggleNotifications(e.target.checked)}
                      disabled={enableLoading}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: enableLoading ? 'not-allowed' : 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: (!!user?.pushSubscription) ? '#10b981' : '#ccc', transition: '.4s', borderRadius: '24px',
                      opacity: enableLoading ? 0.6 : 1
                    }}>
                      <span style={{
                        position: 'absolute', height: '18px', width: '18px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                        transform: (!!user?.pushSubscription) ? 'translateX(20px)' : 'translateX(0)'
                      }}></span>
                    </span>
                  </label>
                </div>

                 {user?.isPremium && (
                    <button 
                        type="button"
                        onClick={handleTestPush}
                        className="btn-ghost"
                        style={{ fontSize: '13px', textDecoration: 'underline', marginBottom: '16px', display: 'block' }}
                        disabled={testLoading}
                    >
                        {testLoading ? 'Sending...' : 'Send a verify alert'}
                    </button>
                )}

                {testError && <div className="profile__error" style={{ marginBottom: '16px', fontSize: '13px' }}>{testError}</div>}
                {alertError && <div className="profile__error" style={{ marginBottom: '16px' }}>{alertError}</div>}
                {alertMessage && <div className="profile__success" style={{ marginBottom: '16px' }}>{alertMessage}</div>}

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
                    🤖 <strong style={{ color: 'var(--text-main)' }}>Android Users:</strong> Notifications work directly in Chrome. No extra setup required.
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
                    <p style={{ margin: 0 }}>📱 iOS: Requires "Add to Home Screen".</p>
                    <p style={{ margin: '6px 0 0' }}>🤖 Android / Desktop: Works directly in your browser.</p>
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
