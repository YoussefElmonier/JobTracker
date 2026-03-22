import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import {
  RiLogoutBoxLine, RiVipCrownFill, RiMoonLine, RiSunLine, RiUserLine,
  RiDashboardLine, RiKanbanView2, RiBellLine, RiPriceTag2Line
} from 'react-icons/ri'
import { useTheme } from '../context/ThemeContext'
import logoLight from '../assets/logo-light.png'
import logoDark from '../assets/logo-dark.png'
import './Navbar.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: <RiDashboardLine /> },
  { to: '/kanban',    label: 'Job Board', icon: <RiKanbanView2 /> },
  { to: '/reminders', label: 'Reminders', icon: <RiBellLine /> },
  { to: '/profile',   label: 'Profile',   icon: <RiUserLine /> },
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

  const [showNotifs, setShowNotifs] = useState(false)
  const [notifications, setNotifications] = useState([])
  const notifRef = useRef(null)

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAsRead = async (notif) => {
    if (!notif.read) {
      try {
        await api.put(`/notifications/${notif._id}/read`)
        setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true } : n))
      } catch (err) {
        console.error(err)
      }
    }
    setShowNotifs(false)
    if (notif.jobId) {
      navigate('/kanban') // or specifically to that job card if supported
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (err) {
      console.error(err)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

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
            {/* Notifications */}
            <div className="navbar__notifs" ref={notifRef} style={{ position: 'relative' }}>
              <button 
                className="navbar__toggle" 
                onClick={() => setShowNotifs(!showNotifs)} 
                title="Notifications"
                style={{ position: 'relative' }}
              >
                <RiBellLine />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '0', right: '0',
                    background: '#ef4444', color: '#fff', fontSize: '0.65rem',
                    fontWeight: 'bold', width: '16px', height: '16px',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', transform: 'translate(25%, -25%)'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifs && (
                <div className="navbar__dropdown" style={{
                  position: 'absolute', top: '120%', right: '0',
                  width: '320px', background: 'var(--surface-color, #fff)',
                  border: '1px solid var(--border-color, #e5e5e0)',
                  borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 100, overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e5e5e0)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Notifications</strong>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: '#4b6ef5', fontSize: '0.8rem', cursor: 'pointer' }}>
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif._id} 
                          onClick={() => handleMarkAsRead(notif)}
                          style={{
                            padding: '12px 16px', borderBottom: '1px solid var(--border-color, #f0f0f0)',
                            background: notif.read ? 'transparent' : 'rgba(75, 110, 245, 0.05)',
                            cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px',
                            transition: 'background 0.2s ease'
                          }}
                        >
                          <div style={{
                            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '6px',
                            background: notif.read ? 'transparent' : '#4b6ef5'
                          }} />
                          <div>
                            <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.4 }}>{notif.message}</p>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

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
