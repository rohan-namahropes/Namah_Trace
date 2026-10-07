import React from 'react'
import {
  LayoutDashboard,
  Layers,
  Cpu,
  Anchor,
  Database,
  RefreshCw,
  LogOut,
  X,
  ShieldCheck,
  User,
} from 'lucide-react'

export function Sidebar({
  activeView,
  setActiveView,
  counts,
  mobileOpen,
  onClose,
  onLogout,
  user,
  storageMode,
  onOpenSqlModal,
  onResetSeed,
}) {
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'
  const role = user?.user_metadata?.role || (user?.email?.includes('admin') ? 'admin' : 'operator')
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'rope', label: 'Rope Batches', icon: Anchor, count: counts.rope },
    { id: 'yarn', label: 'Yarn Batches', icon: Cpu, count: counts.yarn },
    { id: 'flat_yarn', label: 'Flat Yarn Batches', icon: Layers, count: counts.flat_yarn },
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
            <span className="brand-sub">TRACE V1</span>
          </div>
        </div>
        <button className="icon-button side-close" onClick={onClose} aria-label="Close navigation">
          <X size={19} />
        </button>
      </div>

      {/* Workspace Indicator */}
      <div className="workspace-badge-box">
        <div className="workspace-status-dot"></div>
        <div className="workspace-info">
          <small>MANUFACTURING</small>
          <strong>Namah Operations</strong>
        </div>
        <span className={`storage-pill ${storageMode}`}>
          {storageMode === 'supabase' ? 'Cloud' : 'Local'}
        </span>
      </div>

      {/* Primary Navigation */}
      <nav className="side-nav">
        <p className="nav-group-label">TRACEABILITY MATRIX</p>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              className={`nav-item-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleNav(item.id)}
            >
              <Icon size={17} className="nav-icon" />
              <span className="nav-label-text">{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="nav-count-badge">{item.count}</span>
              )}
            </button>
          )
        })}

        <p className="nav-group-label" style={{ marginTop: '28px' }}>
          SYSTEM TOOLS
        </p>
        <button className="nav-item-btn subtle" onClick={onOpenSqlModal}>
          <Database size={15} className="nav-icon" />
          <span className="nav-label-text">Supabase Schema SQL</span>
        </button>
        <button
          className="nav-item-btn subtle"
          onClick={() => {
            if (window.confirm('Reset local workspace to default V1 seed scenario (523, 523 TA, 523 PB, 5417)?')) {
              onResetSeed()
            }
          }}
        >
          <RefreshCw size={15} className="nav-icon" />
          <span className="nav-label-text">Reset Demo Scenario</span>
        </button>
      </nav>

      {/* User & Sign Out Footer */}
      <div className="side-bottom">
        <div className="user-profile-card">
          <div className="user-avatar-circle">{initials || 'OP'}</div>
          <div className="user-profile-meta">
            <div className="user-name-row">
              <strong>{displayName}</strong>
              <span className={`role-badge ${role}`}>
                {role === 'admin' ? 'Admin' : 'Operator'}
              </span>
            </div>
            <small>{user?.email || 'operator@namah.internal'}</small>
          </div>
        </div>
        <button className="logout-action-btn" onClick={onLogout}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  )
}
