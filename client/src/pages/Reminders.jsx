import React, { useMemo, useState } from 'react'
import { format, isToday, isPast, parseISO, addDays, isFuture } from 'date-fns'
import {
  RiBellLine, RiAlarmWarningLine, RiCheckLine,
  RiTimeLine, RiCalendarLine, RiExternalLinkLine, RiEdit2Line,
} from 'react-icons/ri'
import { useJobs } from '../hooks/useJobs'
import AddJobModal from '../components/AddJobModal'
import './Reminders.css'

function getFollowUpDate(job) {
  if (!job.dateApplied) return null
  // Follow up 7 days after applying if still in 'applied' or 'waiting'
  if (job.status === 'applied' || job.status === 'waiting') {
    return addDays(new Date(job.dateApplied), 7)
  }
  return null
}

function getUrgency(followUpDate) {
  if (!followUpDate) return null
  if (isPast(followUpDate) && !isToday(followUpDate)) return 'overdue'
  if (isToday(followUpDate)) return 'today'
  return 'upcoming'
}

const URGENCY_CONFIG = {
  overdue:  { label: 'Overdue',  color: '#f43f5e', icon: <RiAlarmWarningLine />, order: 0 },
  today:    { label: 'Today',    color: '#f59e0b', icon: <RiBellLine />,          order: 1 },
  upcoming: { label: 'Upcoming', color: '#6366f1', icon: <RiTimeLine />,          order: 2 },
}

export default function Reminders() {
  const { jobs, loading, updateJob } = useJobs()
  const [editJob, setEditJob]        = useState(null)

  const reminders = useMemo(() => {
    return jobs
      .map(job => {
        const followUpDate = getFollowUpDate(job)
        const urgency      = getUrgency(followUpDate)
        return { ...job, followUpDate, urgency }
      })
      .filter(r => r.urgency !== null)
      .sort((a, b) => {
        const orderA = URGENCY_CONFIG[a.urgency]?.order ?? 99
        const orderB = URGENCY_CONFIG[b.urgency]?.order ?? 99
        if (orderA !== orderB) return orderA - orderB
        return new Date(a.followUpDate) - new Date(b.followUpDate)
      })
  }, [jobs])

  const overdue  = reminders.filter(r => r.urgency === 'overdue')
  const today    = reminders.filter(r => r.urgency === 'today')
  const upcoming = reminders.filter(r => r.urgency === 'upcoming')

  const handleMarkDone = async (job) => {
    // Move to 'waiting' effectively resetting the timer or snooze by bumping dateApplied
    await updateJob(job._id, { status: 'waiting', dateApplied: new Date().toISOString().slice(0, 10) })
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="dashboard__loading"><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="page-container reminders">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reminders</h1>
          <p className="page-subtitle">Follow up on pending applications, sorted by urgency</p>
        </div>
        <div className="reminders__summary">
          {overdue.length > 0 && (
            <span className="reminders__badge reminders__badge--overdue">
              <RiAlarmWarningLine /> {overdue.length} Overdue
            </span>
          )}
          {today.length > 0 && (
            <span className="reminders__badge reminders__badge--today">
              <RiBellLine /> {today.length} Today
            </span>
          )}
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="reminders__empty">
          <RiCheckLine className="reminders__empty-icon" />
          <h2>You're all caught up!</h2>
          <p>No pending follow-ups right now. Keep applying!</p>
        </div>
      ) : (
        <div className="reminders__sections">
          {[
            { key: 'overdue',  label: 'Overdue', items: overdue },
            { key: 'today',    label: 'Due Today', items: today },
            { key: 'upcoming', label: 'Upcoming (this week)', items: upcoming },
          ].map(section => section.items.length > 0 && (
            <div key={section.key} className="reminders__section">
              <div className="reminders__section-header">
                {URGENCY_CONFIG[section.key].icon}
                <h2 className="reminders__section-title" style={{ color: URGENCY_CONFIG[section.key].color }}>
                  {section.label}
                </h2>
                <span className="reminders__section-count">{section.items.length}</span>
              </div>

              <div className="reminders__list">
                {section.items.map((job, index) => (
                  <div
                    key={job._id}
                    className={`reminders__item animate-slide-up stagger-${(index % 4) + 1} reminders__item--${job.urgency}`}
                    id={`reminder-${job._id}`}
                  >
                    <div
                      className="reminders__urgency-bar"
                      style={{ background: URGENCY_CONFIG[job.urgency].color }}
                    />

                    <div className="reminders__item-logo">
                      {job.company?.[0]?.toUpperCase() || '?'}
                    </div>

                    <div className="reminders__item-info">
                      <p className="reminders__item-company">{job.company}</p>
                      <p className="reminders__item-title">{job.title}</p>
                      <div className="reminders__item-meta">
                        <span className={`badge badge-${job.status}`}>{job.status}</span>
                        {job.contact && (
                          <span className="reminders__contact">👤 {job.contact}</span>
                        )}
                      </div>
                    </div>

                    <div className="reminders__item-dates">
                      <div className="reminders__date-row">
                        <RiCalendarLine />
                        <span>Applied: {format(new Date(job.dateApplied), 'MMM d, yyyy')}</span>
                      </div>
                      <div
                        className="reminders__date-row reminders__date-row--followup" 
                        style={{ color: URGENCY_CONFIG[job.urgency].color }}
                      >
                        <RiBellLine />
                        <span>
                          Follow up:{' '}
                          {isToday(job.followUpDate)
                            ? 'Today'
                            : format(job.followUpDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="reminders__item-actions" >
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost"  
                          title="View posting"
                        >
                          <RiExternalLinkLine />
                        </a>
                      )}
                      <button
                        className="btn btn-ghost"
                        onClick={() => setEditJob(job)}
                        title="Edit"
                      >
                        <RiEdit2Line />
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleMarkDone(job)}
                        title="Snooze / Mark followed-up"
                      >
                        <RiCheckLine /> Done
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editJob && (
        <AddJobModal
          onClose={() => setEditJob(null)}
          onSave={async (data) => {
            await updateJob(editJob._id, data)
            setEditJob(null)
          }}
          initial={editJob}
          isEdit
        />
      )}
    </div>
  )
}
