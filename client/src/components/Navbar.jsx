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
  { to: '/dashboard', label: 'Home',     icon: <RiDashboardLine /> },
  { to: '/kanban',    label: 'Board',    icon: <RiKanbanView2 /> },
  { to: '/reminders', label: 'Alerts',   icon: <RiBellLine /> },
  { to: '/profile',   label: 'Profile',  icon: <RiUserLine /> },
  { to: '/pricing',   label: 'Pro',      icon: <RiPriceTag2Line /> },
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
                  <RiVipCrownFill className="navbar__premium-icon crown-glow" />
                )}
              </NavLink>
            ))}
          </div>

          {/* User / Actions */}
          <div className="navbar__right">
            {/* Notifications */}
            <div className="navbar__notifs" ref={notifRef} style={{ position: 'relative' }}>
              <button 
                className={`navbar__toggle ${unreadCount > 0 ? 'notif-pulse' : ''}`} 
                onClick={() => setShowNotifs(!showNotifs)} 
                title="Notifications"
                style={{ position: 'relative' }}
              >
                <RiBellLine />
                {unreadCount > 0 && (
                  <span className="notif-badge">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifs && (
                <div className="navbar__dropdown glass-panel">
                  <div className="notif-dropdown__header">
                    <strong>Notifications</strong>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="notif-dropdown__mark-all">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="notif-dropdown__list">
                    {notifications.length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px' }}>
                        <span className="empty-state__icon" style={{ fontSize: '2rem' }}>✨</span>
                        <p className="empty-state__title" style={{ fontSize: '1rem' }}>No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif._id} 
                          onClick={() => handleMarkAsRead(notif)}
                          className={`notif-item ${notif.read ? '' : 'notif-item--unread'}`}
                        >
                          <div className={`notif-item__dot ${notif.read ? '' : 'notif-item__dot--active'}`} />
                          <div className="notif-item__body">
                            <p className="notif-item__text">{notif.message}</p>
                            <span className="notif-item__time">
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
      <nav className="mobile-bottom-nav glass-panel" aria-label="Mobile navigation">
        <div className="mobile-bottom-nav__inner">
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
              <div className="mobile-nav__indicator" />
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
