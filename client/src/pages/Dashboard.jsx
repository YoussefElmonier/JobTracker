import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import { format, subDays, startOfDay, isSameDay } from 'date-fns'
import {
  RiBriefcaseLine, RiArrowRightUpLine, RiFocus3Line,
  RiTrophyLine, RiTimeLine, RiAddLine, RiChromeLine, RiLinkM
} from 'react-icons/ri'
import { useJobs } from '../hooks/useJobs'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import AddJobModal from '../components/AddJobModal'
import UpgradeModal from '../components/UpgradeModal'
import ImportFromURLModal from '../components/ImportFromURLModal'
import OnboardingTour from '../components/OnboardingTour'
import PageWrapper from '../components/PageWrapper'
import api from '../api/axios'
import './Dashboard.css'

function CompanyLogo({ logo, company }) {
  const [error, setError] = useState(false)
  const fallback = company?.trim()?.[0]?.toUpperCase() || '?'

  if (logo && !error) {
    const proxyUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/logo/proxy?url=${encodeURIComponent(logo)}`
    return (
      <img
        src={proxyUrl}
        alt={company}
        onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px' }}
      />
    )
  }
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#eee',
      color: '#111111',
      fontWeight: '700',
      fontSize: '1rem',
      borderRadius: '10px'
    }}>
      {fallback}
    </div>
  )
}

function StatCard({ icon, label, value, color, trend, loading = false }) {
  if (loading) {
    return (
      <div className="stat-card">
        <div className="skeleton" style={{ width: '42px', height: '42px', borderRadius: '50%' }} />
        <div className="skeleton" style={{ width: '80%', height: '32px', marginTop: '12px' }} />
        <div className="skeleton" style={{ width: '50%', height: '14px', marginTop: '8px' }} />
      </div>
    )
  }
  return (
    <div className="stat-card glass-panel">
      <div className="stat-card__header">
        <div className="stat-card__icon" style={{ background: `${color}18`, color }}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className="stat-card__trend positive">
            <RiArrowRightUpLine />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e5e0',
      padding: '8px 12px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      color: 'var(--text-main)'
    }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>{payload[0].value} apps</p>
    </div>
  )
}

export default function Dashboard() {
  const { theme } = useTheme()
  const { user, loading: authLoading, refreshUser } = useAuth()
  const { jobs, loading, createJob } = useJobs()
  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importPrefill, setImportPrefill] = useState(null)
  
  // Onboarding Logic
  const [showOnboarding, setShowOnboarding] = useState(false)
  
  useEffect(() => {
    // Show onboarding if user exists and hasn't completed it
    if (user && user.onboardingCompleted === false) {
      setShowOnboarding(true)
    }
  }, [user])

  const handleOnboardingComplete = async () => {
    try {
      await api.post('/auth/onboarding/complete')
      await refreshUser()
      setShowOnboarding(false)
    } catch (err) {
      console.error('Failed to save onboarding progress', err)
      setShowOnboarding(false) // Still close it to not block the user
    }
  }


  const WEEKLY_GOAL = 5
  const stats = useMemo(() => {
    const total = jobs.length
    const interviews = jobs.filter(j => j.status === 'interview').length
    const offers = jobs.filter(j => j.status === 'offer').length
    const rejected = jobs.filter(j => j.status === 'rejected').length
    const responded = interviews + offers + rejected
    const responseRate = total ? Math.round((responded / total) * 100) : 0
    const weekStart = startOfDay(subDays(new Date(), 6))
    const thisWeek = jobs.filter(j => new Date(j.dateApplied) >= weekStart).length
    return { total, interviews, offers, responseRate, thisWeek }
  }, [jobs])

  const chartData = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = subDays(new Date(), 13 - i)
      const count = jobs.filter(j => isSameDay(new Date(j.dateApplied), date)).length
      return { date: format(date, 'MMM d'), count }
    })
  }, [jobs])

  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied))
    .slice(0, 5)

  const weeklyProgress = Math.min((stats.thisWeek / WEEKLY_GOAL) * 100, 100)

  return (
    <PageWrapper>
      {showOnboarding && <OnboardingTour onComplete={handleOnboardingComplete} />}
      <div className="page-container dashboard">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Hey there, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="page-subtitle">Here's your job search overview</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-import-url" 
              onClick={() => setShowImportModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RiLinkM /> Import from URL
            </button>
            <button className="btn btn-primary" onClick={() => { setImportPrefill(null); setShowModal(true) }}>
              <RiAddLine /> Add Application 
            </button>
          </div>
        </div>

        {/* Extension Installation Prompt - desktop only */}
        <div className="extension-banner animate-slide-up">
          <div className="extension-banner__icon">
            <RiChromeLine />
          </div>
          <div className="extension-banner__content">
            <h3>Supercharge your search with the trkr Clipper</h3>
            <p>Save jobs from LinkedIn and Indeed with one click using the browser extension.</p>
          </div>
          <div className="extension-banner__actions">
            <button className="btn btn-primary" onClick={() => window.open("https://chromewebstore.google.com/detail/hhijikdgibndadckjonhggcnfbhnjpnf?utm_source=item-share-cb", "_blank")}>Get Extension</button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="animate-slide-up stagger-1">
            <StatCard
              loading={loading}
              icon={<RiBriefcaseLine />}
              label="Total Applications"
              value={stats.total}
              color="#4b6ef5"
              trend={12}
            />
          </div>
          <div className="animate-slide-up stagger-2">
            <StatCard
              loading={loading}
              icon={<RiArrowRightUpLine />}
              label="Response Rate"
              value={`${stats.responseRate}%`}
              color="#4b6ef5"
            />
          </div>
          <div className="animate-slide-up stagger-3">
            <StatCard
              loading={loading}
              icon={<RiTrophyLine />}
              label="Offers Received"
              value={stats.offers}
              color="#4b6ef5"
            />
          </div>
          <div className="animate-slide-up stagger-4">
            <StatCard
              loading={loading}
              icon={<RiTimeLine />}
              label="This Week"
              value={stats.thisWeek}
              color="#4b6ef5"
            />
          </div>
        </div>

        {/* Onboarding Checklist — and show only if not completed */}
        {!user?.onboardingCompleted && (
          <div className="onboarding-checklist glass-panel animate-slide-up stagger-5">
            <div className="checklist-header">
              <div>
                <h3 className="checklist-title">Getting Started</h3>
                <p className="checklist-subtitle">Complete these steps to master TRKR</p>
              </div>
              <div className="checklist-completion">
                <span className="completion-text">
                  {Math.round([
                    true, // Account created
                    jobs.length > 0,
                    user?.cvText?.length > 0,
                    user?.gmailConnected,
                  ].filter(Boolean).length / 4 * 100)}% Complete
                </span>
              </div>
            </div>
            
            <div className="checklist-grid">
              <div className={`checklist-item ${true ? 'done' : ''}`}>
                <div className="checklist-point"><RiCheckLine /></div>
                <div className="checklist-info">
                  <h4>Create Account</h4>
                  <p>You're already here! Welcome aboard.</p>
                </div>
              </div>

              <div className={`checklist-item ${jobs.length > 0 ? 'done' : ''}`} onClick={() => !jobs.length && setShowModal(true)}>
                <div className="checklist-point">{jobs.length > 0 ? <RiCheckLine /> : '2'}</div>
                <div className="checklist-info">
                  <h4>Add your first job</h4>
                  <p>Manual add or import from URL to start tracking.</p>
                </div>
                {!jobs.length && <RiArrowRightLine className="item-arrow" />}
              </div>

              <div className={`checklist-item ${user?.cvText?.length > 0 ? 'done' : ''}`} onClick={() => navigate('/profile')}>
                <div className="checklist-point">{user?.cvText?.length > 0 ? <RiCheckLine /> : '3'}</div>
                <div className="checklist-info">
                  <h4>Upload your CV</h4>
                  <p>Enable AI matching and automated cover letters.</p>
                </div>
                {!user?.cvText && <RiArrowRightLine className="item-arrow" />}
              </div>

              <div className={`checklist-item ${user?.gmailConnected ? 'done' : ''}`} onClick={() => navigate('/profile')}>
                <div className="checklist-point">{user?.gmailConnected ? <RiCheckLine /> : '4'}</div>
                <div className="checklist-info">
                  <h4>Connect Gmail</h4>
                  <p>Unlock automatic status updates from recruiter emails.</p>
                </div>
                {!user?.gmailConnected && <RiArrowRightLine className="item-arrow" />}
              </div>
            </div>
          </div>
        )}

        <div className="dashboard__main-grid animate-slide-up stagger-2">

          {/* Chart Section */}
          <div className="card dashboard__chart-card">
            <h2 className="dashboard__chart-title">Applications Over Time</h2>
            <p className="dashboard__chart-sub">Daily application volume for the last 14 days</p>
            <div className="dashboard__chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4b6ef5" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4b6ef5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e5e0' : '#333'} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#4b6ef5"
                    strokeWidth={2}
                    fill="url(#areaGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#4b6ef5', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Goal Card (Dark) */}
          <div className="dashboard__weekly-card animate-slide-up stagger-3">
            <div className="dashboard__weekly-content">
              <h2 className="dashboard__weekly-title"><RiFocus3Line /> Weekly Goal</h2>
              <p className="dashboard__weekly-sub" style={{ opacity: 0.7 }}>Set a weekly application goal to stay on track with your career map.</p>
              
              <div className="dashboard__weekly-stats">
                <div className="dashboard__weekly-header">
                  <span className="dashboard__weekly-label">Progress</span>
                  <span className="dashboard__weekly-pct">{Math.round(weeklyProgress)}%</span>
                </div>
                <div className="dashboard__weekly-bar-bg">
                  <div
                    className="dashboard__weekly-bar-fill"
                    style={{ width: `${weeklyProgress}%` }}
                  />
                </div>
                {weeklyProgress >= 100 && (
                  <p className="dashboard__weekly-done">
                    Goal reached! You're crushing it.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Applications */}
        <div className="card dashboard__recent-card">
          <div className="dashboard__recent-header">
            <h2 className="dashboard__recent-title">Recent Applications</h2>
            <Link to="/kanban" className="btn btn-secondary">View all</Link>
          </div>
          
          {loading ? (
            <div className="dashboard__recent-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="dashboard__recent-item">
                  <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '10px', marginRight: '16px' }} />
                  <div className="dashboard__recent-info">
                    <div className="skeleton" style={{ width: '40%', height: '14px', marginBottom: '8px' }} />
                    <div className="skeleton" style={{ width: '60%', height: '12px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="empty-state animate-float">
              <span className="empty-state__icon">🎯</span>
              <h3 className="empty-state__title">No applications yet</h3>
              <p className="empty-state__text">Start your journey by adding your first application.</p>
            </div>
          ) : (
            <div className="dashboard__recent-list">
              {recentJobs.map(job => (
                <div key={job._id} className="dashboard__recent-item">
                  <div className="dashboard__recent-logo">
                    <CompanyLogo logo={job.companyLogo} company={job.company} />
                  </div>
                  <div className="dashboard__recent-info">
                    <p className="dashboard__recent-company">{job.company}</p>
                    <p className="dashboard__recent-role">{job.title}</p>
                  </div>
                  <div className="dashboard__recent-right">
                    <span className={`badge`} style={{ 
                      background: job.status === 'offer' ? '#111' : 
                                 job.status === 'interview' ? '#eef2ff' :
                                 job.status === 'waiting' ? '#d4f7a0' : '#e4dcff',
                      color: job.status === 'offer' ? '#fff' : '#111'
                    }}>
                      {job.status}
                    </span>
                    <span className="dashboard__recent-date">
                      {format(new Date(job.dateApplied), 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <AddJobModal
            onClose={() => { setShowModal(false); setImportPrefill(null) }}
            onLimitReached={() => setShowUpgrade(true)}
            initial={importPrefill || { status: 'applied' }}
            isEdit={false}
            onSave={async (data) => {
              await createJob(data)
              setShowModal(false)
              setImportPrefill(null)
            }}
          />
        )}

        {showUpgrade && (
          <UpgradeModal
            reason="limit"
            onClose={() => setShowUpgrade(false)}
          />
        )}

        {showImportModal && (
          <ImportFromURLModal
            onClose={() => setShowImportModal(false)}
            onExtracted={(prefilled) => {
              setImportPrefill({ ...prefilled, status: 'applied' })
              setShowModal(true)
            }}
          />
        )}
      </div>
    </PageWrapper>
  )
}
