import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  RiLogoutBoxLine, RiVipCrownFill, RiMoonLine, RiSunLine,
  RiDashboardLine, RiKanbanView2, RiBellLine, RiPriceTag2Line
} from 'react-icons/ri'
import { useTheme } from '../context/ThemeContext'
import logoLight from '../assets/logo-light.png'
import logoDark from '../assets/logo-dark.png'
import './Navbar.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: <RiDashboardLine /> },
  { to: '/kanban',    label: 'Kanban',    icon: <RiKanbanView2 /> },
  { to: '/reminders', label: 'Reminders', icon: <RiBellLine /> },
  { to: '/pricing',   label: 'Pricing',   icon: <RiPriceTag2Line /> },
]

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout, isPremium } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'JT'

  return (
    <>
      {/* ── Top Navbar ── */}
      <nav className="navbar animate-slide-down">
        <div className="navbar__container">
          {/* Logo */}
          <div className="navbar__logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img
              src={theme === 'light' ? logoLight : logoDark}
              alt="TRKR"
              className="navbar__logo-img"
            />
          </div>

          {/* Center Nav Pill — hidden on mobile */}
          <div className="navbar__nav-pill">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `navbar__link ${isActive ? 'navbar__link--active' : ''}`
                }
              >
                {item.label}
                {item.to === '/pricing' && isPremium && (
                  <RiVipCrownFill className="navbar__premium-icon" />
                )}
              </NavLink>
            ))}
          </div>

          {/* User / Actions */}
          <div className="navbar__right">
            <div className="navbar__avatar" title={user?.email}>{initials}</div>
            <button className="navbar__toggle" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'light' ? <RiMoonLine /> : <RiSunLine />}
            </button>
            <button className="navbar__logout" onClick={handleLogout} title="Logout">
              <RiLogoutBoxLine />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mobile-nav__link ${isActive ? 'mobile-nav__link--active' : ''}`
            }
          >
            <span className="mobile-nav__icon">{item.icon}</span>
            <span className="mobile-nav__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
