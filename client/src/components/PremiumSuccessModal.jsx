import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RiCheckLine, RiVipCrownFill } from 'react-icons/ri'
import './PremiumSuccessModal.css'

const FEATURES = [
  'Unlimited job applications',
  'AI Cover Letter Generator',
  'Resume Analyzer',
  'Full Salary Insights',
  'All 10 Interview Questions',
  'Gmail Auto-Scanner'
]

export default function PremiumSuccessModal({ onClose }) {
  const [visibleItems, setVisibleItems] = useState([])

  useEffect(() => {
    // Reveal checkmarks one by one
    FEATURES.forEach((_, index) => {
      setTimeout(() => {
        setVisibleItems(prev => [...prev, index])
      }, (index + 1) * 200)
    });
  }, []);

  return createPortal(
    <div className="premium-success-overlay">
      <div className="premium-success-modal glass-panel animate-slide-up">
        {/* Animated Particles */}
        <div className="premium-success-modal__particles">
          {[...Array(12)].map((_, i) => (
            <div 
              key={i} 
              className="particle" 
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                width: '4px', height: '4px'
              }} 
            />
          ))}
        </div>

        <div className="premium-success-modal__content">
          <div className="premium-success-modal__crown">
            <RiVipCrownFill />
          </div>
          
          <h2 className="premium-success-modal__title">Welcome to Premium!</h2>
          <p className="premium-success-modal__subtitle">
            You now have unlimited access to everything TRKR has to offer for life time
          </p>

          <div className="premium-success-modal__features">
            {FEATURES.map((feature, idx) => (
              <div 
                key={idx} 
                className={`premium-success-modal__feature ${visibleItems.includes(idx) ? 'visible' : ''}`}
              >
                <span className="premium-success-modal__check">
                  <RiCheckLine />
                </span>
                {feature}
              </div>
            ))}
          </div>

          <button className="premium-success-modal__btn shimmer-btn" onClick={onClose}>
            Start Exploring
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
