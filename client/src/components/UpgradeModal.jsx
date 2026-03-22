import React from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  RiVipCrownFill, RiCloseLine, RiInfinityLine, 
  RiRobot2Line, RiChat3Line, RiMailLine, RiScan2Line 
} from 'react-icons/ri'
import './UpgradeModal.css'

export default function UpgradeModal({ onClose, reason = 'limit' }) {
  const navigate = useNavigate()

  const messages = {
    premium: {
      title: "Unlock Premium Features",
      body: "Experience the full power of TRKR. Upgrade once and get unlimited access to all AI tools and automation, forever.",
    },
    gmail: {
      title: "Premium Gmail Tracker",
      body: "Automatically detect interviews, offers, and rejections directly from your inbox. Upgrade to Premium to connect your Gmail.",
    },
    limit: {
      title: "You've reached the free limit",
      body: "Free accounts support up to 10 job applications. Upgrade to Premium for unlimited jobs and AI Cover Letters — one time, forever.",
    },
    coverLetter: {
      title: "Premium Feature",
      body: "AI Cover Letter generation is a Premium feature. Upgrade once and generate unlimited cover letters, forever.",
    },
    questions_limit: {
      title: "AI Generation Limit Reached",
      body: "Free accounts support up to 3 AI Interview Question generations. Upgrade to Premium for unlimited generations and prep like a pro.",
    },
    ai_insights: {
      title: "Premium AI Insights",
      body: "Real-time AI Salary Insights and Job Summaries are Premium features. Upgrade once to unlock these deep insights for every job posting.",
    },
  }

  const { title, body } = messages[reason] || messages.limit

  return (
    <div className="upgrade-modal-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button className="upgrade-modal__close" onClick={onClose}>
          <RiCloseLine />
        </button>

        {/* Crown Icon */}
        <div className="upgrade-modal__crown">
          <RiVipCrownFill />
        </div>

        <h2 className="upgrade-modal__title">{title}</h2>
        <p className="upgrade-modal__body">{body}</p>

        <div className="upgrade-modal__grid">
          <div className="upgrade-modal__feature">
            <RiInfinityLine /> Unlimited applications
          </div>
          <div className="upgrade-modal__feature">
            <RiMailLine /> Gmail Auto-Tracking
          </div>
          <div className="upgrade-modal__feature">
            <RiScan2Line /> Resume Match Score
          </div>
          <div className="upgrade-modal__feature">
            <RiRobot2Line /> Unlimited AI Letters
          </div>
        </div>

        <button
          className="upgrade-modal__btn"
          onClick={() => { onClose(); navigate('/pricing') }}
        >
          ⚡ Upgrade for $10 — One Time, Forever
        </button>

        <p className="upgrade-modal__note">Secure payment via Paddle · No subscriptions</p>
      </div>
    </div>
  )
}
