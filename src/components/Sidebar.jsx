import React from 'react'
import {
  Layers,
  Cpu,
  Anchor,
  Database,
  LogOut,
  X,
} from 'lucide-react'

export function Sidebar({
  activeView,
  setActiveView,
  counts,
  mobileOpen,
  onClose,
  onLogout,
  user,
  profile,
  isAdmin,
  storageMode,
  onOpenSqlModal,
}) {
  const displayName = profile?.display_name || 'Namah User'
  const displayRole = profile?.role === 'admin' ? 'admin' : 'operator'
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'rope', label: 'Rope', icon: Anchor, count: counts.rope },
    { id: 'yarn', label: 'Yarn', icon: Cpu, count: counts.yarn },
    { id: 'flat_yarn', label: 'Flat Yarn', icon: Layers, count: counts.flat_yarn },
  ]

  const handleNav = (id) => {
    setActiveView(id)
    if (onClose) onClose()
  }

  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="side-top">
        <div className="brand-logo-container">
          <img src="/namah-logo.webp" alt="Namah Logo" className="brand-logo-img" />
          <div className="brand-title-wrap">
            <strong className="brand-name">Namah Trace</strong>
            <span className="brand-sub">MANUFACTURING TRACEABILITY · V1.1</span>
          </div>
        </div>
        <button className="icon-button side-close" onClick={onClose} aria-label="Close navigation">
          <X size={19} />
        </button>
      </div>

      <div className="workspace-badge-box">
        <div className="workspace-status-dot"></div>
        <div className="workspace-info">
          <strong>Internal operations</strong>
        </div>
        <span className={`storage-pill ${storageMode === 'supabase' ? 'supabase' : 'unavailable'}`}>
          {storageMode === 'supabase' ? 'Live' : 'Unavailable'}
        </span>
      </div>

      {/* Primary Navigation */}
      <nav className="side-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              className={`nav-item-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleNav(item.id)}
            >
              {Icon && <Icon size={17} className="nav-icon" />}
              <span className="nav-label-text">{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="nav-count-badge">{item.count}</span>
              )}
            </button>
          )
        })}

      </nav>

      {/* User & Sign Out Footer */}
      <div className="side-bottom">
        <div className="user-profile-card">
          <div className="user-avatar-circle">{initials || 'OP'}</div>
          <div className="user-profile-meta">
            <div className="user-name-row">
              <strong>{displayName}</strong>
              <span className={`role-badge ${displayRole}`}>
                {displayRole === 'admin' ? 'Admin' : 'Operator'}
              </span>
            </div>
            <small>{user?.email || 'operator@namah.internal'}</small>
          </div>
        </div>
        {isAdmin && (
          <button className="sidebar-admin-tool" onClick={onOpenSqlModal}>
            <Database size={14} /> Quantity tracking SQL
          </button>
        )}
        <button className="logout-action-btn" onClick={onLogout}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  )
}
