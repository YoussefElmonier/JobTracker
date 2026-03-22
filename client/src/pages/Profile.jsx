import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import './Profile.css'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const [cvText, setCvText] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.cvText) {
      setCvText(user.cvText)
    }
  }, [user])

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
        const res = await api.put('/auth/profile/cv', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
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

  return (
    <div className="profile-page animate-fade-in">
      <div className="profile__header">
        <h1 className="profile__title">My Profile</h1>
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
      </div>
    </div>
  )
}
