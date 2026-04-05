import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  RiBriefcaseLine, RiBarChart2Line, RiNotification3Line,
  RiArrowRightLine, RiCheckLine, RiStarLine, RiMoonLine, RiSunLine,
  RiMenuLine, RiCloseLine
} from 'react-icons/ri'
import { useTheme } from '../context/ThemeContext'
import Footer from '../components/Footer'
import logoLight from '../assets/logo-light.png'
import logoDark from '../assets/logo-dark.png'
import PageWrapper from '../components/PageWrapper'
import './Landing.css'

const FEATURES = [
  {
    icon: <RiBriefcaseLine />,
    color: 'indigo',
    title: 'Visual Pipeline',
    desc: 'Transform your job search into a professional workflow. Drag and drop jobs through custom stages and track every touchpoint.',
    points: ['Fluid Kanban board', 'One-click status updates', 'Organized job tracking'],
  },
  {
    icon: <RiBarChart2Line />,
    color: 'cyan',
    title: 'AI Intelligence',
    desc: 'Uncover your application potential. Get instant resume matching scores, tailored cover letters, and interview preparation.',
    points: ['Resume matching score', 'AI-powered cover letters', 'Curated interview prep'],
  },
  {
    icon: <RiNotification3Line />,
    color: 'violet',
    title: 'Seamless Automation',
    desc: 'Stop entering data manually. Use our Chrome extension and Gmail scanner to automatically import applications.',
    points: ['Chrome browser extension', 'Automatic Gmail scanning', 'Instant job importing'],
  },
]

export default function Landing() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const navigate  = useNavigate()
  const heroRef   = useRef(null)
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])


  return (
    <PageWrapper>
      <div className={`landing ${isMenuOpen ? 'menu-open' : ''}`}>
        {/* Navbar */}
        <nav className="landing__nav">
          <div className="landing__nav-inner">
            <div className="landing__nav-logo">
              <img src={theme === 'light' ? logoLight : logoDark} alt="trkr" className="landing__logo-img" />
            </div>
            
            <div className={`landing__nav-links ${isMenuOpen ? 'active' : ''}`}>
              <a href="#features" className="landing__nav-link" onClick={() => setIsMenuOpen(false)}>Features</a>
              <div className="landing__nav-actions">
                <button className="landing__theme-toggle" onClick={toggleTheme}>
                  {theme === 'light' ? <RiMoonLine /> : <RiSunLine />}
                </button>
                <Link to="/login"    className="btn btn-ghost">Log In</Link>
                <Link to="/register" className="btn btn-primary">Get Started</Link>
              </div>
            </div>

            <button className="landing__mobile-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <RiCloseLine /> : <RiMenuLine />}
            </button>
          </div>
        </nav>

        {/* Hero */}
        <section className="landing__hero" ref={heroRef}>
          <div className="hero-particles">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i} 
                className="particle" 
                style={{
                  left: `${Math.random() * 100}%`,
                  width: `${Math.random() * 6 + 2}px`,
                  height: `${Math.random() * 6 + 2}px`,
                  animationDelay: `${Math.random() * 10}s`,
                  animationDuration: `${Math.random() * 10 + 10}s`
                }} 
              />
            ))}
          </div>
          <div className="landing__hero-inner">
            <div className="landing__hero-content">
              {/* Badge */}
              <div className="landing__badge">
                <RiBriefcaseLine style={{ marginRight: '6px' }} />
                <span>Modernize your job search today</span>
              </div>

              {/* Headline */}
              <h1 className="landing__headline">
                Elevate your job search with <span className="gradient-text">trkr.</span>
              </h1>

              <p className="landing__subheadline">
                Tired of spreadsheets? Use trkr to manage your job search pipeline, 
                generate AI-powered cover letters, and track your interview success.
              </p>

              {/* CTAs */}
              <div className="landing__ctas">
                <Link to="/register" id="hero-cta-register" className="btn btn-primary btn-lg">
                  Start for free
                  <RiArrowRightLine />
                </Link>
                <Link to="/login" id="hero-cta-login" className="btn btn-secondary btn-lg">
                  Log In
                </Link>
              </div>

              {/* Benefits list (Replacing fake stats with real value props) */}
              <div className="landing__hero-benefits animate-slide-up stagger-3" style={{ marginTop: '32px', display: 'flex', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <RiCheckLine style={{ color: 'var(--accent)' }} /> No credit card required
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <RiCheckLine style={{ color: 'var(--accent)' }} /> 1-minute setup
                </div>
              </div>
            </div>

            {/* Hero mockup */}
            <div className="landing__hero-mockup animate-slide-up stagger-2">
              <div className="landing__mockup-window">
                <div className="landing__mockup-bar">
                  <span /><span /><span />
                </div>
                <div className="landing__mockup-content">
                  {/* Mini kanban preview */}
                  <div className="landing__mini-kanban">
                    {[
                      { label: 'Applied', count: 12, color: '#6366f1' },
                      { label: 'Interview', count: 4, color: '#4b6ef5' },
                      { label: 'Offer', count: 1, color: '#10b981' },
                    ].map(col => (
                      <div key={col.label} className="landing__mini-col">
                        <div className="landing__mini-col-header" style={{ color: col.color }}>
                          <span className="landing__mini-dot" style={{ background: col.color }} />
                          {col.label}
                        </div>
                        {[...Array(2)].map((_, i) => (
                          <div key={i} className="landing__mini-card">
                            <div className="landing__mini-card-logo" style={{ background: `${col.color}15`, color: col.color }}>
                              {['G', 'A', 'M', 'S'][i % 4]}
                            </div>
                            <div className="landing__mini-card-details">
                              <div className="landing__mini-card-company" />
                              <div className="landing__mini-card-role" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="landing__features" id="features">
          <div className="landing__section-header">
            <p className="landing__section-eyebrow">The trkr Ecosystem</p>
            <h2 className="landing__section-title">Everything you need to land the job</h2>
            <p className="landing__section-sub">A focused set of powerful tools designed to turn every application into an offer.</p>
          </div>

          <div className="landing__features-grid">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`landing__feature-card animate-slide-up stagger-${(i % 3) + 1}`}>
                <div className="landing__feature-icon">
                  {f.icon}
                </div>
                <h3 className="landing__feature-title">{f.title}</h3>
                <p className="landing__feature-desc">{f.desc}</p>
                <ul className="landing__feature-points">
                  {f.points.map(p => (
                    <li key={p}>
                      <RiCheckLine className="landing__check" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="landing__cta-banner">
          <h2 className="landing__cta-banner-title">
            Ready to take control of your <span>job search?</span>
          </h2>
          <p className="landing__cta-banner-sub">
            Join the early testers who are landing their dream role faster with trkr.
          </p>
          <Link to="/register" id="bottom-cta-register" className="btn btn-primary btn-lg">
            Get started — it's free
            <RiArrowRightLine />
          </Link>
        </section>

        <Footer />
      </div>
    </PageWrapper>
  )
}
