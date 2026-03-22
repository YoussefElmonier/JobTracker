import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { initializePaddle } from '@paddle/paddle-js'
import {
  RiCheckLine, RiCloseLine, RiShieldFlashLine,
  RiInfinityLine, RiBriefcaseLine, RiRobot2Line,
  RiLockLine, RiVipCrownFill, RiMailLine,
  RiScan2Line, RiListCheck, RiMoneyDollarCircleLine
} from 'react-icons/ri'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import PremiumConfetti from '../components/PremiumConfetti'
import PremiumSuccessModal from '../components/PremiumSuccessModal'
import './Pricing.css'

const FREE_FEATURES = [
  { icon: <RiBriefcaseLine />, text: 'Track up to 10 active jobs', ok: true },
  { icon: <RiCheckLine />,     text: 'Kanban board & organization',  ok: true },
  { icon: <RiRobot2Line />,    text: 'Basic AI Cover Letters', ok: true },
  { icon: <RiLockLine />,      text: 'Gmail Scanner (Auto-track)',    ok: false },
  { icon: <RiLockLine />,      text: 'Detailed Resume Match Score',    ok: false },
  { icon: <RiLockLine />,      text: 'Advanced Interview Prep',    ok: false },
]

const PREMIUM_FEATURES = [
  { icon: <RiInfinityLine />, text: 'Unlimited job applications',   ok: true },
  { icon: <RiMailLine />,     text: 'Gmail Email Scanner (Auto-track)', ok: true },
  { icon: <RiScan2Line />,    text: 'Resume Match Analysis (0-100%)',   ok: true },
  { icon: <RiRobot2Line />,   text: 'Unlimited AI Cover Letters',    ok: true },
  { icon: <RiListCheck />,    text: 'Tailored Interview Questions',    ok: true },
  { icon: <RiMoneyDollarCircleLine />, text: 'Premium Salary Insights', ok: true },
]

export default function Pricing() {
  const { user, token, isPremium, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [paddle, setPaddle] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  useEffect(() => {
    // Check for success redirect from Paddle
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      const verify = async () => {
        try {
          await api.post('/payment/verify-payment')
          await refreshUser()
          setToast({ type: 'success', msg: '🎉 Welcome to Premium! You now have unlimited access.' })
          setShowSuccess(true)
          setTimeout(() => setShowPremiumModal(true), 1500)
          navigate('/pricing', { replace: true })
        } catch (err) {
          console.error('Manual verification failed:', err)
          setToast({ type: 'error', msg: '❌ Payment confirmed but status not updated. Refreshing...' })
          setTimeout(() => refreshUser(), 2000)
        }
      }
      verify()
    }
  }, [])

  useEffect(() => {
    initializePaddle({
      token: import.meta.env.VITE_PADDLE_TOKEN || 'live_317e28edda2ce78f0630e0efb32', // Used the token we saw in your dashboard
      environment: import.meta.env.VITE_PADDLE_ENV || 'production',
      checkout: {
        settings: { displayMode: 'overlay', theme: 'dark', locale: 'en' }
      }
    }).then(p => setPaddle(p))
  }, [])

  const handleUpgrade = async () => {
    if (!user) { navigate('/login'); return }
    if (isPremium) return
    setLoading(true)
    try {
      const res = await api.post('/payment/create-checkout')
      const { transactionId } = res.data
      paddle?.Checkout.open({
        transactionId,
        settings: {
          successUrl: `${window.location.origin}/pricing?payment=success`,
        }
      })
    } catch (err) {
      console.error('❌ Upgrade Error:', err)
      console.log('📦 Paddle instance:', paddle)
      setToast({ type: 'error', msg: '❌ Failed to open checkout. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pricing-page">
      {/* Toast */}
      {toast && (
        <div className={`pricing-toast pricing-toast--${toast.type}`}>
          {toast.msg}
          <button onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      <div className="pricing-hero">
        <div className="pricing-badge">Simple Pricing</div>
        <h1 className="pricing-title">One payment.<br />Unlimited access.</h1>
        <p className="pricing-sub">No subscriptions. No monthly fees. Pay once, use forever.</p>
      </div>

      <div className="pricing-cards">
        {/* Free Card */}
        <div className="pricing-card pricing-card--free">
          <div className="pricing-card__header">
            <div className="pricing-card__plan">Free</div>
            <div className="pricing-card__price">
              <span className="pricing-card__amount">$0</span>
              <span className="pricing-card__per">forever</span>
            </div>
            <p className="pricing-card__desc">Perfect for getting started with your job search.</p>
          </div>

          <ul className="pricing-card__features">
            {FREE_FEATURES.map((f, i) => (
              <li key={i} className={`pricing-card__feature ${f.ok ? '' : 'pricing-card__feature--locked'}`}>
                <span className={`pricing-card__feature-icon ${f.ok ? 'ok' : 'no'}`}>
                  {f.ok ? f.icon : <RiLockLine size={12} />}
                </span>
                <span className="pricing-card__feature-text">{f.text}</span>
              </li>
            ))}
          </ul>

          <button className="pricing-card__btn pricing-card__btn--current" disabled>
            {isPremium ? 'Previous Plan' : 'Current Plan'}
          </button>
        </div>

        {/* Premium Card */}
        <div className="pricing-card pricing-card--premium">
          <div className="pricing-card__crown"><RiVipCrownFill /></div>
          <div className="pricing-card__popular">Best Value</div>

          <div className="pricing-card__header">
            <div className="pricing-card__plan">Premium</div>
            <div className="pricing-card__price">
              <span className="pricing-card__amount">$10</span>
              <span className="pricing-card__per">one-time</span>
            </div>
            <p className="pricing-card__desc">Everything you need to land the perfect job, forever.</p>
          </div>

          <ul className="pricing-card__features">
            {PREMIUM_FEATURES.map((f, i) => (
              <li key={i} className="pricing-card__feature">
                <span className="pricing-card__feature-icon ok">{f.icon}</span>
                <span className="pricing-card__feature-text">{f.text}</span>
              </li>
            ))}
          </ul>

          {isPremium ? (
            <button className="pricing-card__btn pricing-card__btn--owned" disabled>
              <RiVipCrownFill /> You're Premium! 
            </button>
          ) : (
            <button
              className="pricing-card__btn pricing-card__btn--upgrade"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? 'Opening checkout...' : '⚡ Upgrade for $10'}
            </button>
          )}

          <p className="pricing-card__guarantee">
            🔒 Secure payment via Paddle · One-time charge · No hidden fees
          </p>
        </div>
      </div>

      <PremiumConfetti trigger={showSuccess} />
      {showPremiumModal && (
        <PremiumSuccessModal onClose={() => setShowPremiumModal(false)} />
      )}
    </div>
  )
}
