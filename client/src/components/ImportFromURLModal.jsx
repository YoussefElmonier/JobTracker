import React, { useState, useEffect, useRef } from 'react'
import { RiCloseLine, RiLinkM, RiMagicLine, RiErrorWarningLine } from 'react-icons/ri'
import { createPortal } from 'react-dom'
import api from '../api/axios'
import './ImportFromURLModal.css'

export default function ImportFromURLModal({ onClose, onExtracted }) {
  const [url, setUrl]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const inputRef              = useRef(null)

  // Auto-focus & body scroll lock
  useEffect(() => {
    inputRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleExtract = async () => {
    const trimmed = url.trim()
    if (!trimmed) { setError('Please enter a job listing URL.'); return }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Please enter a valid URL starting with http:// or https://')
      return
    }

    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/jobs/fetch-from-url', { url: trimmed })

      // Map Groq field names → our form fields
      const prefilled = {
        title:       data.jobTitle    || '',
        company:     data.company     || '',
        location:    data.location    || '',
        description: [data.description, data.requirements]
                      .filter(Boolean).join('\n\n') || '',
        url:         trimmed,
      }

      onClose()
      onExtracted(prefilled)
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not extract job details. Try a different URL.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleExtract()
  }

  return createPortal(
    <div className="ifu-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ifu-modal" role="dialog" aria-modal="true" aria-labelledby="ifu-title">

        {/* Header */}
        <div className="ifu-header">
          <div className="ifu-header__left">
            <div className="ifu-icon">
              <RiMagicLine />
            </div>
            <div>
              <h2 id="ifu-title" className="ifu-title">Import from URL</h2>
              <p className="ifu-subtitle">Paste a job listing URL to auto-fill the form</p>
            </div>
          </div>
          <button className="ifu-close" onClick={onClose} aria-label="Close">
            <RiCloseLine />
          </button>
        </div>

        {/* Body */}
        <div className="ifu-body">
          <p className="ifu-hint">Works with LinkedIn, Indeed, Glassdoor, and most job sites.</p>

          <div className="ifu-input-wrap">
            <RiLinkM className="ifu-input-icon" />
            <input
              ref={inputRef}
              id="ifu-url-input"
              type="url"
              className="ifu-input"
              placeholder="https://www.linkedin.com/jobs/view/..."
              value={url}
              onChange={e => { setUrl(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              disabled={loading}
              aria-label="Job listing URL"
            />
          </div>

          {error && (
            <div className="ifu-error">
              <RiErrorWarningLine />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="ifu-loading">
              <div className="ifu-spinner" />
              <span>Extracting job details...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ifu-footer">
          <button
            id="ifu-cancel"
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            id="ifu-extract"
            type="button"
            className="btn btn-primary ifu-extract-btn"
            onClick={handleExtract}
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <><span className="auth-spinner" /> Extracting...</>
            ) : (
              <><RiMagicLine /> Extract Details</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
