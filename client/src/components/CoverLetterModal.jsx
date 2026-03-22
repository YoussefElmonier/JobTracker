import React, { useState, useEffect, useRef } from 'react'
import { RiCloseLine, RiDownloadLine, RiFileCopyLine, RiRefreshLine } from 'react-icons/ri'
import jsPDF from 'jspdf'
import UpgradeModal from './UpgradeModal'
import './AddJobModal.css'

export default function CoverLetterModal({ job, onClose, onGenerate, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState(() => {
    const cl = job.aiCoverLetter
    if (typeof cl === 'string' && cl) return cl
    return cl?.premium || cl?.free || ''
  })
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const generatingRef = useRef(false)  // prevent StrictMode double-fire

  useEffect(() => {
    if (!content && job.description && !generatingRef.current) {
      generateLetter()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generateLetter = async (regenerate = false) => {
    if (generatingRef.current) return
    generatingRef.current = true
    setLoading(true)
    setError('')
    setWarning('')
    try {
      const data = await onGenerate(job._id, regenerate) // { coverLetter: string, warning?: string }
      setContent(data.coverLetter)
      if (data.warning) setWarning(data.warning)
      if (onSuccess) onSuccess()
    } catch (err) {
      if (err.code === 'limit_reached') {
        setShowUpgrade(true)
        setError("Free limit reached. Upgrade for unlimited.")
      } else {
        setError(err.message || 'Failed to generate cover letter. Please try again.')
      }
    } finally {
      setLoading(false)
      generatingRef.current = false
    }
  }

  const handleCopy = () => navigator.clipboard.writeText(content)

  const handleDownload = () => {
    const doc   = new jsPDF()
    const lines = doc.splitTextToSize(content, 180)
    doc.text(lines, 15, 20)
    doc.save(`Cover_Letter_${job.company.replace(/\s+/g, '_')}.pdf`)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title">Cover Letter</h2>
            <p className="modal__subtitle">{job.title} at {job.company}</p>
          </div>
          <button className="modal__close" onClick={onClose}><RiCloseLine /></button>
        </div>

        <div className="modal__form" style={{ gap: '16px' }}>
          {error && <div className="auth-error">{error}</div>}
          {warning && <div className="auth-error" style={{ color: '#d97706', backgroundColor: '#fef3c7', padding: '10px', borderRadius: '4px', marginBottom: '10px', fontSize: '0.9rem' }}>{warning}</div>}

          {loading ? (
            <div style={{ display: 'flex', padding: '40px', justifyContent: 'center' }}>
              <div className="auth-spinner" style={{ width: '30px', height: '30px' }} />
            </div>
          ) : (
            <textarea
              className="form-input modal__textarea"
              style={{ minHeight: '300px', fontSize: '0.9rem', lineHeight: '1.5' }}
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          )}

          <div className="modal__footer">
            <button type="button" className="btn btn-secondary" onClick={() => generateLetter(true)} disabled={loading}>
              <RiRefreshLine /> Regenerate
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleCopy} disabled={!content || loading}>
              <RiFileCopyLine /> Copy
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={!content || loading}>
              <RiDownloadLine /> Download PDF
            </button>
          </div>
        </div>
      </div>
      {showUpgrade && (
        <UpgradeModal reason="limit" onClose={() => setShowUpgrade(false)} />
      )}
    </div>
  )
}
