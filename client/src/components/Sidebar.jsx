import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  RiDashboardLine, RiKanbanView2, RiBellLine, RiUserLine,
  RiLogoutBoxLine, RiMenuFoldLine, RiMenuUnfoldLine,
  RiBriefcaseLine, RiPriceTag2Line, RiVipCrownFill
} from 'react-icons/ri'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/dashboard',  icon: <RiDashboardLine />,  label: 'Dashboard' },
  { to: '/kanban',     icon: <RiKanbanView2 />,    label: 'Kanban' },
  { to: '/reminders',  icon: <RiBellLine />,        label: 'Reminders' },
  { to: '/profile',    icon: <RiUserLine />,        label: 'Profile' },
  { to: '/pricing',    icon: <RiPriceTag2Line />,   label: 'Pricing' },
]

export default function Sidebar() {
  const { user, logout, isPremium } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'JT'

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <RiBriefcaseLine />
        </div>
        {!collapsed && <span className="sidebar__logo-text">TRKR</span>}
      </div>

      {/* Nav */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <span className="sidebar__link-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar__link-label">{item.label}</span>}
            {!collapsed && item.to === '/pricing' && !isPremium && (
              <span className="sidebar__upgrade-pill">Upgrade</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="sidebar__bottom">
        <button
          className="sidebar__collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <RiMenuUnfoldLine /> : <RiMenuFoldLine />}
          {!collapsed && <span>Collapse</span>}
        </button>

        <div className="sidebar__user">
          <div className="sidebar__avatar">{initials}</div>
          {!collapsed && (
            <div className="sidebar__user-info">
              <p className="sidebar__user-name">
                {user?.name}
                {isPremium && <RiVipCrownFill className="sidebar__crown" title="Premium Member" />}
              </p>
              <p className="sidebar__user-email">{user?.email}</p>
            </div>
          )}
        </div>

        <button className="sidebar__logout" onClick={handleLogout}>
          <RiLogoutBoxLine />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
