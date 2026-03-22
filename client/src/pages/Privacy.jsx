import React from 'react'
import { Link } from 'react-router-dom'
import './Legal.css'

export default function Privacy() {
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/">trkr</Link>
        <span>/ Privacy Policy</span>
      </nav>

      <div className="legal-container">
        <div className="legal-header">
          <div className="legal-badge">Legal</div>
          <h1>Privacy Policy</h1>
          <p className="legal-meta">Last updated: March 22, 2026</p>
        </div>

        <div className="legal-section">
          <h2>1. Information We Collect</h2>
          <p>We collect the following types of information:</p>
          <ul>
            <li><strong>Account data:</strong> Name, email address, and password (hashed)</li>
            <li><strong>Job data:</strong> Job applications, notes, and reminders you create</li>
            <li><strong>Usage data:</strong> Pages visited, features used, and error logs</li>
            <li><strong>Payment data:</strong> Handled entirely by Paddle — we never store your card details</li>
            <li><strong>Gmail Integration Data:</strong> Read-only access to recruiter emails, processed transiently without storage.</li>
          </ul>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide, maintain, and improve the TRKR service</li>
            <li>Process payments and manage your subscription status</li>
            <li>Send important account and service-related notifications</li>
            <li>Provide AI-powered features (cover letters, interview questions)</li>
          </ul>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>3. Data Storage</h2>
          <p>Your data is stored securely in MongoDB Atlas (cloud database). We implement industry-standard security measures to protect your personal information from unauthorized access.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>4. Third-Party Services</h2>
          <p>TRKR uses the following third-party services:</p>
          <ul>
            <li><strong>Paddle</strong> — Payment processing</li>
            <li><strong>Google OAuth</strong> — Optional social sign-in</li>
            <li><strong>Groq AI</strong> — AI-powered content generation</li>
          </ul>
          <p>Each third-party service has its own privacy policy governing their use of your data.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>6. Data Sharing</h2>
          <p>We do not sell, trade, or rent your personal information to third parties. We share data only with service providers necessary to operate TRKR.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>7. Google API Data Usage (Gmail Integration)</h2>
          <p>
            TRKR's use and transfer of information received from Google APIs to any other app will adhere to the{' '}
            <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" rel="noopener noreferrer">
              Google API Services User Data Policy
            </a>, including the Limited Use requirements.
          </p>
          <ul>
            <li><strong>Scope of Access:</strong> We strictly request read-only access to your Gmail.</li>
            <li><strong>Data Processing:</strong> TRKR only scans unread emails looking for specific recruiter-related keywords. If found, a maximum of 500 characters is sent to our AI provider (Groq) for intent classification (e.g., Interview, Rejection, Offer).</li>
            <li><strong>No Storage:</strong> We do not store, log, or save the contents of your emails in our database. Only the structured status outcome is attached to your job card.</li>
            <li><strong>User Control:</strong> You can disconnect and clear your Gmail tokens at any time from your Account settings.</li>
          </ul>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>8. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and data</li>
          </ul>
          <p>To exercise these rights, contact us at <a href="mailto:support@trkr.app">support@trkr.app</a>.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>9. Cookies</h2>
          <p>We use minimal, essential cookies for authentication (JWT tokens stored in localStorage). We do not use advertising or tracking cookies.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>10. Contact</h2>
          <p>For any privacy-related questions, please contact <a href="mailto:support@trkr.app">support@trkr.app</a>.</p>
        </div>
      </div>
    </div>
  )
}
