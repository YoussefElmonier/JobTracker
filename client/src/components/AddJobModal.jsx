import React, { useState, useEffect, useRef } from 'react'
import { RiCloseLine, RiBriefcaseLine, RiLink, RiUser3Line, RiCalendarLine } from 'react-icons/ri'
import './AddJobModal.css'

const STATUS_OPTIONS = [
  { value: 'applied',   label: 'Applied' },
  { value: 'interview', label: 'Interview Scheduled' },
  { value: 'waiting',   label: 'Waiting' },
  { value: 'offer',     label: 'Offer Received' },
  { value: 'rejected',  label: 'Rejected' },
]

const DEFAULT_FORM = {
  company:     '',
  title:       '',
  dateApplied: new Date().toISOString().slice(0, 10),
  url:         '',
  contact:     '',
  notes:       '',
  location:    '',
  description: '',
  status:      'applied',
}

export default function AddJobModal({ onClose, onSave, onLimitReached, initial = {}, isEdit = false }) {
  const [form, setForm]       = useState({ ...DEFAULT_FORM, ...initial })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const firstRef              = useRef(null)

  // Autofocus first field & trap scroll
  useEffect(() => {
    firstRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleChange = (e) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.company.trim()) { setError('Company is required'); return }
    if (!form.title.trim())   { setError('Job title is required'); return }
    setError('')
    setLoading(true)
    try {
      await onSave(form)
    } catch (err) {
      if (err.code === 'limit_reached') {
        onClose()
        onLimitReached?.()
        return
      }
      setError(err.message || 'Failed to save. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true"
        aria-labelledby="modal-title">

        {/* Header */}
        <div className="modal__header">
          <div className="modal__header-left">
            <div className="modal__icon"><RiBriefcaseLine /></div>
            <div>
              <h2 id="modal-title" className="modal__title">
                {isEdit ? 'Edit Application' : 'Add Application'}
              </h2>
              <p className="modal__subtitle">
                {isEdit ? 'Update this job application' : 'Track a new job application'}
              </p>
            </div>
          </div>
          <button
            id="modal-close"
            className="modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <RiCloseLine />
          </button>
        </div>

        {/* Body */}
        <form className="modal__form" onSubmit={handleSubmit} noValidate>
          {error && <div className="auth-error">{error}</div>}

          <div className="modal__row">
            <div className="form-group">
              <label className="form-label" htmlFor="m-company">Company *</label>
              <input
                id="m-company"
                ref={firstRef}
                name="company"
                type="text"
                className="form-input"
                placeholder="e.g. Google"
                value={form.company}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="m-title">Job Title *</label>
              <input
                id="m-title"
                name="title"
                type="text"
                className="form-input"
                placeholder="e.g. Software Engineer"
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="modal__row">
            <div className="form-group">
              <label className="form-label" htmlFor="m-date">
                <RiCalendarLine /> Date Applied
              </label>
              <input
                id="m-date"
                name="dateApplied"
                type="date"
                className="form-input"
                value={form.dateApplied}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="m-status">Status</label>
              <select
                id="m-status"
                name="status"
                className="form-input"
                value={form.status}
                onChange={handleChange}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="m-url">
              <RiLink /> Job Posting URL
            </label>
            <input
              id="m-url"
              name="url"
              type="url"
              className="form-input"
              placeholder="https://..."
              value={form.url}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="m-contact">
              <RiUser3Line /> Contact / Recruiter
            </label>
            <input
              id="m-contact"
              name="contact"
              type="text"
              className="form-input"
              placeholder="Name or email of contact"
              value={form.contact}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="m-location">📍 Location <span style={{ fontWeight: 400, opacity: 0.6, fontSize: '0.8rem' }}>(helps AI detect salary country)</span></label>
            <input
              id="m-location"
              name="location"
              type="text"
              className="form-input"
              placeholder="e.g. Cairo, Egypt or Remote"
              value={form.location}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="m-description">Job Description (copy/paste for AI)</label>
            <textarea
              id="m-description"
              name="description"
              className="form-input modal__textarea"
              placeholder="Paste full job description here to enable AI features..."
              value={form.description}
              onChange={handleChange}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="m-notes">Notes</label>
            <textarea
              id="m-notes"
              name="notes"
              className="form-input modal__textarea"
              placeholder="Interview details, impressions, next steps..."
              value={form.notes}
              onChange={handleChange}
              rows={2}
            />
          </div>

          {/* Footer */}
          <div className="modal__footer">
            <button
              id="modal-cancel"
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              id="modal-save"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <><span className="auth-spinner" /> Saving...</>
              ) : (
                isEdit ? 'Save Changes' : 'Add Application'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
