import React from 'react'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/PageWrapper'
import './Legal.css'

export default function Refund() {
  return (
    <PageWrapper>
      <div className="legal-page animate-fade">
        <nav className="legal-nav">
          <Link to="/">trkr</Link>
          <span>/ Refund Policy</span>
        </nav>

        <div className="legal-container">
          <div className="legal-header">
            <div className="legal-badge">Legal</div>
            <h1>Refund Policy</h1>
            <p className="legal-meta">Last updated: March 21, 2026</p>
          </div>

          <div className="legal-section">
            <h2>Our Commitment</h2>
            <p>We want you to be completely satisfied with TRKR Premium. If you're not happy with your purchase, we're here to help.</p>
          </div>

          <hr className="legal-divider" />

          <div className="legal-section">
            <h2>30-Day Money-Back Guarantee</h2>
            <p>If you are not satisfied with your TRKR Premium purchase for any reason, you may request a full refund within <strong>30 days</strong> of your purchase date.</p>
            <p>To request a refund, simply contact us at <a href="mailto:support@trkr.app">support@trkr.app</a> with your order details and we will process your refund promptly.</p>
          </div>

          <hr className="legal-divider" />

          <div className="legal-section">
            <h2>How Refunds Work</h2>
            <ul>
              <li>Refunds are issued to the original payment method used at checkout</li>
              <li>Refunds are typically processed within 5–10 business days</li>
              <li>Upon refund, your account will revert to the Free plan</li>
              <li>Payments are processed via Paddle — refunds are subject to Paddle's processing timelines</li>
            </ul>
          </div>

          <hr className="legal-divider" />

          <div className="legal-section">
            <h2>Eligibility</h2>
            <p>Refund requests are eligible if:</p>
            <ul>
              <li>The request is made within 30 days of purchase</li>
              <li>The account has not been found to have violated our Terms of Service</li>
            </ul>
          </div>

          <hr className="legal-divider" />

          <div className="legal-section">
            <h2>Contact Us</h2>
            <p>For refund requests or questions, please email us at <a href="mailto:support@trkr.app">support@trkr.app</a>. Please include your order ID (from your Paddle receipt) to help us process your request quickly.</p>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
