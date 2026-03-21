import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import { format, subDays, startOfDay, isSameDay } from 'date-fns'
import {
  RiBriefcaseLine, RiArrowRightUpLine, RiFocus3Line,
  RiTrophyLine, RiTimeLine, RiAddLine, RiChromeLine
} from 'react-icons/ri'
import { useJobs } from '../hooks/useJobs'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import AddJobModal from '../components/AddJobModal'
import UpgradeModal from '../components/UpgradeModal'
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

function StatCard({ icon, label, value, color, trend }) {
  return (
    <div className="stat-card">
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
  const { user, loading: authLoading } = useAuth()
  const { jobs, loading, createJob } = useJobs()
  const [showModal, setShowModal] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
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
    <div className="page-container dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Hey there, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="page-subtitle">Here's your job search overview</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <RiAddLine /> Add Application 
        </button>
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
          <button className="btn btn-primary" onClick={() => alert("Extension Link")}>Get Extension</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="animate-slide-up stagger-1">
          <StatCard
            icon={<RiBriefcaseLine />}
            label="Total Applications"
            value={loading ? '—' : stats.total}
            color="#4b6ef5"
            trend={12}
          />
        </div>
        <div className="animate-slide-up stagger-2">
          <StatCard
            icon={<RiArrowRightUpLine />}
            label="Response Rate"
            value={loading ? '—' : `${stats.responseRate}%`}
            color="#4b6ef5"
          />
        </div>
        <div className="animate-slide-up stagger-3">
          <StatCard
            icon={<RiTrophyLine />}
            label="Offers Received"
            value={loading ? '—' : stats.offers}
            color="#4b6ef5"
          />
        </div>
        <div className="animate-slide-up stagger-4">
          <StatCard
            icon={<RiTimeLine />}
            label="This Week"
            value={loading ? '—' : stats.thisWeek}
            color="#4b6ef5"
          />
        </div>
      </div>

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
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : recentJobs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#888' }}>
            <RiBriefcaseLine style={{ fontSize: '2rem', marginBottom: '12px' }} />
            <p>No applications yet.</p>
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
          onClose={() => setShowModal(false)}
          onLimitReached={() => setShowUpgrade(true)}
          onSave={async (data) => {
            await createJob(data)
            setShowModal(false)
          }}
        />
      )}

      {showUpgrade && (
        <UpgradeModal
          reason="limit"
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  )
}
