import React from 'react'
import { Link } from 'react-router-dom'
import './Legal.css'

export default function Terms() {
  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <Link to="/">trkr</Link>
        <span>/ Terms of Service</span>
      </nav>

      <div className="legal-container">
        <div className="legal-header">
          <div className="legal-badge">Legal</div>
          <h1>Terms of Service</h1>
          <p className="legal-meta">Last updated: March 22, 2026</p>
        </div>

        <div className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using TRKR ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>2. Description of Service</h2>
          <p>TRKR is a job application tracking platform that helps users organize and manage their job search process. Features include a job tracker dashboard, Kanban board, reminders, and AI-powered tools for cover letters and interview preparation.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>3. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating an account.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>4. Payments and Premium Access</h2>
          <p>TRKR offers a one-time payment for lifetime Premium access. All payments are processed securely by Paddle. By completing a purchase, you agree to Paddle's terms and conditions. All sales are final unless covered by our Refund Policy.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>5. Prohibited Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any part of the Service</li>
            <li>Transmit any harmful, offensive, or disruptive content</li>
            <li>Reverse engineer or copy any part of the platform</li>
          </ul>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>6. Third-Party Integrations (Gmail & AI)</h2>
          <p>If you choose to use the Gmail Integration feature:</p>
          <ul>
            <li>You grant TRKR restricted, read-only access to your Gmail account solely for the purpose of tracking job application updates.</li>
            <li>TRKR utilizes third-party AI strictly for intent classification of recognized recruiter emails.</li>
            <li>We do not guarantee 100% accuracy. The system may miss emails or misclassify statuses. You are ultimately responsible for verifying your job statuses.</li>
          </ul>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>7. Intellectual Property</h2>
          <p>All content, features, and functionality of TRKR are owned by us and protected by copyright and other intellectual property laws.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>8. Limitation of Liability</h2>
          <p>TRKR is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>9. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
        </div>

        <hr className="legal-divider" />

        <div className="legal-section">
          <h2>10. Contact</h2>
          <p>For any questions about these terms, please contact us at <a href="mailto:support@trkr.app">support@trkr.app</a>.</p>
        </div>
      </div>
    </div>
  )
}
