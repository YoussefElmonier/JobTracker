import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { initializePaddle } from '@paddle/paddle-js'
import {
  RiCheckLine, RiCloseLine, RiShieldFlashLine,
  RiInfinityLine, RiBriefcaseLine, RiRobot2Line,
  RiLockLine, RiVipCrownFill, RiMailLine,
  RiScan2Line, RiListCheck, RiMoneyDollarCircleLine,
  RiFlashlightFill, RiGroupLine, RiSmartphoneLine,
  RiTimerFlashLine, RiStarFill
} from 'react-icons/ri'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import PremiumConfetti from '../components/PremiumConfetti'
import PremiumSuccessModal from '../components/PremiumSuccessModal'
import PageWrapper from '../components/PageWrapper'
import './Pricing.css'

const FREE_FEATURES = [
  { icon: <RiBriefcaseLine />, text: 'Track up to 10 active jobs', ok: true },
  { icon: <RiCheckLine />, text: 'Kanban board & organization', ok: true },
  { icon: <RiRobot2Line />, text: '3 AI Cover Letters (free)', ok: true },
  { icon: <RiMoneyDollarCircleLine />, text: 'AI Salary Estimates (unlimited)', ok: true },
  { icon: <RiListCheck />, text: 'Interview Prep (10 questions)', ok: true },
  { icon: <RiFlashlightFill />, text: '3 Premium Previews', ok: true },
]

const PRO_FEATURES = [
  { icon: <RiInfinityLine />, text: 'Unlimited job applications', ok: true },
  { icon: <RiMailLine />, text: 'Gmail Email Scanner (Auto-track)', ok: true },
  { icon: <RiScan2Line />, text: 'Detailed Resume Match Analysis', ok: true },
  { icon: <RiRobot2Line />, text: 'Unlimited AI Cover Letters', ok: true },
  { icon: <RiListCheck />, text: 'Unlimited Interview Prep', ok: true },
  { icon: <RiShieldFlashLine />, text: 'Premium AI Insights on every card', ok: true },
]

const ELITE_FEATURES = [
  { icon: <RiStarFill />, text: 'Everything in Pro', ok: true },
  { icon: <RiTimerFlashLine />, text: 'Priority AI processing', ok: true },
  { icon: <RiGroupLine />, text: '1-on-1 resume review session', ok: true },
  { icon: <RiSmartphoneLine />, text: 'Multi-platform device sync', ok: true },
  { icon: <RiFlashlightFill />, text: 'Early access to new features', ok: true },
]

export default function Pricing() {
  const { user, token, isPremium, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [paddle, setPaddle] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  
  // Toggle between Monthly ('mo') and Yearly ('yr') - Yearly default to show savings first
  const [billingCycle, setBillingCycle] = useState('yr')

  const PRICES = {
    pro: { mo: 11.99, yr: 8.25 },   // $11.99 monthly, $99 yearly ($8.25/mo equivalent)
    elite: { mo: 29.99, yr: 19.99 } // $29.99 monthly, ~$240 yearly ($19.99/mo equivalent)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      const verify = async () => {
        try {
          await api.post('/payment/verify-payment')
          await refreshUser()
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
  }, [navigate, refreshUser])

  useEffect(() => {
    initializePaddle({
      token: import.meta.env.VITE_PADDLE_TOKEN || 'live_317e28edda2ce78f0630e0efb32',
      environment: import.meta.env.VITE_PADDLE_ENV || 'production',
      checkout: {
        settings: { displayMode: 'overlay', theme: 'dark', locale: 'en' }
      }
    }).then(p => setPaddle(p))
  }, [])

  const handleUpgrade = async (planType = 'pro') => {
    if (!user) { navigate('/login'); return }
    if (isPremium && planType === 'pro') return // Already pro
    
    setLoading(true)
    try {
      // In a real scenario, you'd send the planType and billingCycle to the backend
      // so it can create the correct Paddle transaction (Subscription vs Transaction)
      const res = await api.post('/payment/create-checkout', { planType, billingCycle })
      const { transactionId } = res.data
      paddle?.Checkout.open({
        transactionId,
        settings: {
          successUrl: `${window.location.origin}/pricing?payment=success`,
        }
      })
    } catch (err) {
      console.error('❌ Upgrade Error:', err)
      setToast({ type: 'error', msg: '❌ Failed to open checkout. Try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <div className="pricing-page pricing-dark-theme animate-fade">
        {toast && (
          <div className={`pricing-toast pricing-toast--${toast.type}`}>
            {toast.msg}
            <button onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        <div className="pricing-hero">
          <div className="pricing-badge">Pricing Plans</div>
          <h1 className="pricing-title">Level up your<br />job search.</h1>
          <div className="pricing-sub">Pick the plan that fits your ambition.</div>
          
          {/* Billing Toggle */}
          <div className="billing-toggle-wrapper">
            <span className={`billing-label ${billingCycle === 'mo' ? 'active' : ''}`}>Monthly</span>
            <button 
              className={`billing-switch ${billingCycle === 'yr' ? 'switched' : ''}`}
              onClick={() => setBillingCycle(prev => prev === 'mo' ? 'yr' : 'mo')}
            >
              <div className="billing-switch__dot" />
            </button>
            <span className={`billing-label ${billingCycle === 'yr' ? 'active' : ''}`}>
              Yearly <span className="savings-badge">2 Months Free · Best Value</span>
            </span>
          </div>
        </div>

        <div className="pricing-cards-grid">
          {/* Free Card */}
          <div className="pricing-card pricing-card--glass pricing-card--free">
            <div className="pricing-card__header">
              <div className="pricing-card__plan">Free</div>
              <div className="pricing-card__price">
                <span className="pricing-card__amount">$0</span>
                <span className="pricing-card__per">forever</span>
              </div>
              <p className="pricing-card__desc">Essential tools to organize your search.</p>
            </div>

            <ul className="pricing-card__features">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="pricing-card__feature">
                  <span className="pricing-card__feature-icon ok">{f.icon}</span>
                  <span className="pricing-card__feature-text">{f.text}</span>
                </li>
              ))}
            </ul>

            <button className="pricing-card__btn pricing-card__btn--current" disabled>
              {isPremium ? 'Basic Plan' : 'Current Plan'}
            </button>
          </div>

          {/* Pro Card (Middle - Featured with Glow) */}
          <div className="pricing-card pricing-card--glass pricing-card--pro pricing-card--featured">
            <div className="pricing-card__pro-glow" />
            <div className="pricing-card__popular">Most Popular</div>

            <div className="pricing-card__header">
              <div className="pricing-card__plan">Pro</div>
              <div className="pricing-card__price">
                <span className="pricing-card__amount">${PRICES.pro[billingCycle]}</span>
                <span className="pricing-card__per">{billingCycle === 'mo' ? '/mo' : '/mo, billed yearly'}</span>
              </div>
              <p className="pricing-card__desc">Full AI power to land your dream role.</p>
            </div>

            <ul className="pricing-card__features">
              {PRO_FEATURES.map((f, i) => (
                <li key={i} className="pricing-card__feature">
                  <span className="pricing-card__feature-icon ok">{f.icon}</span>
                  <span className="pricing-card__feature-text">{f.text}</span>
                </li>
              ))}
            </ul>

            {isPremium ? (
              <button className="pricing-card__btn pricing-card__btn--owned" disabled>
                <RiVipCrownFill /> Active Product
              </button>
            ) : (
              <button
                className="pricing-card__btn pricing-card__btn--upgrade-pro"
                onClick={() => handleUpgrade('pro')}
                disabled={loading}
              >
                {loading ? 'Opening checkout...' : `Go Pro - $${PRICES.pro[billingCycle]}`}
              </button>
            )}
            <p className="pricing-card__small-print">Secure payment via Paddle</p>
          </div>

          {/* Elite Card */}
          <div className="pricing-card pricing-card--glass pricing-card--elite">
            <div className="pricing-card__header">
              <div className="pricing-card__plan">Elite</div>
              <div className="pricing-card__price">
                <span className="pricing-card__amount">${PRICES.elite[billingCycle]}</span>
                <span className="pricing-card__per">{billingCycle === 'mo' ? '/mo' : '/mo, billed yearly'}</span>
              </div>
              <p className="pricing-card__desc">The ultimate platform for serious candidates.</p>
            </div>

            <ul className="pricing-card__features">
              {ELITE_FEATURES.map((f, i) => (
                <li key={i} className="pricing-card__feature">
                  <span className="pricing-card__feature-icon ok">{f.icon}</span>
                  <span className="pricing-card__feature-text">{f.text}</span>
                </li>
              ))}
            </ul>

            <button
              className="pricing-card__btn pricing-card__btn--upgrade-elite"
              onClick={() => handleUpgrade('elite')}
              disabled={loading}
            >
              {loading ? 'Opening checkout...' : `Join Elite - $${PRICES.elite[billingCycle]}`}
            </button>
            <p className="pricing-card__small-print">Priority support included</p>
          </div>
        </div>

        <PremiumConfetti trigger={showSuccess} />
        {showPremiumModal && (
          <PremiumSuccessModal onClose={() => setShowPremiumModal(false)} />
        )}
      </div>
    </PageWrapper>
  )
}
