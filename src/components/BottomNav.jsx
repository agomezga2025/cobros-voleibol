import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/BottomNav.css'

const BottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { id: 'registrar', label: 'Registrar', path: '/registrar', icon: '➕' },
    { id: 'historico', label: 'Histórico', path: '/historico', icon: '📋' }
  ]

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bottom-nav">
      <div className="nav-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-item ${isActive(tab.path) ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export default BottomNav
