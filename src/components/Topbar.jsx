import React, { useState, useEffect, useRef } from 'react'
import {
  Menu,
  Search,
  Plus,
  Layers,
  Cpu,
  Anchor,
  ArrowRight,
  Bell,
  Cloud,
  HardDrive,
} from 'lucide-react'
import { searchTrace } from '../lib/api'

export function Topbar({
  onOpenMobileNav,
  breadcrumbs,
  onSelectEntity,
  onOpenCreateModal,
  storageMode,
  profile,
  notifications = [],
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const searchRef = useRef(null)
  const createMenuRef = useRef(null)
  const notificationsRef = useRef(null)

  const displayName = profile?.display_name || 'Namah User'
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Handle live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      setSearchError('')
      return
    }

    let active = true
    searchTrace(searchQuery)
      .then((results) => {
        if (active) {
          setSearchResults(results)
          setSearchError('')
          setSearchOpen(true)
        }
      })
      .catch((error) => {
        if (active) {
          setSearchResults([])
          setSearchError(error.message || 'Search failed.')
          setSearchOpen(true)
        }
      })

    return () => {
      active = false
    }
  }, [searchQuery])

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false)
      }
      if (createMenuRef.current && !createMenuRef.current.contains(e.target)) {
        setCreateMenuOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleResultClick = (entityId) => {
    setSearchOpen(false)
    setSearchQuery('')
    onSelectEntity(entityId)
  }

  const getTypeIcon = (type) => {
    if (type === 'flat_yarn') return <Layers size={13} className="text-amber" />
    if (type === 'yarn') return <Cpu size={13} className="text-blue" />
    return <Anchor size={13} className="text-navy" />
  }

  const getTypeLabel = (type) => {
    if (type === 'flat_yarn') return 'Flat Yarn'
    if (type === 'yarn') return 'Yarn'
    return 'Rope'
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu-btn"
          onClick={onOpenMobileNav}
          aria-label="Open mobile navigation"
        >
          <Menu size={20} />
        </button>

        <nav className="breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="crumb-sep">/</span>}
              {crumb.onClick ? (
                <button className="crumb-link" onClick={crumb.onClick}>
                  {crumb.label}
                </button>
              ) : (
                <strong className="crumb-current">{crumb.label}</strong>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="topbar-right">
        <div className="notification-container" ref={notificationsRef}>
          <button
            type="button"
            className={`notification-button ${notifications.length ? 'has-notifications' : ''}`}
            aria-label={`Notifications${notifications.length ? `, ${notifications.length} critical stock alerts` : ''}`}
            aria-haspopup="true"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <Bell size={18} />
            <span className="notification-button-label">Notifications</span>
            {notifications.length > 0 && (
              <span className="notification-count">{notifications.length}</span>
            )}
          </button>
          {notificationsOpen && (
            <section className="notification-dropdown" aria-label="Notifications" aria-live="polite">
              <header>
                <strong>Notifications</strong>
                <span>{notifications.length}</span>
              </header>
              {notifications.length ? (
                <div className="notification-list">
                  {notifications.map((entity) => (
                    <button
                      key={entity.id}
                      type="button"
                      className="notification-item"
                      onClick={() => {
                        setNotificationsOpen(false)
                        onSelectEntity(entity.id)
                      }}
                    >
                      <span className="notification-item-marker" aria-hidden="true" />
                      <span className="notification-item-copy">
                        <strong>Critical stock · {entity.batch_id}</strong>
                        <small>
                          {entity.quantityRemaining} {entity.unit} remaining · threshold{' '}
                          {entity.critical_quantity_threshold} {entity.critical_quantity_threshold_unit}
                        </small>
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="notification-empty">No batches are below their critical stock threshold.</p>
              )}
            </section>
          )}
        </div>

        {/* Global Search */}
        <div className="search-container" ref={searchRef}>
          <div className="search-bar-input-wrap">
            <Search size={16} className="search-bar-icon" />
            <input
              type="text"
              placeholder="Search batches, suppliers, parameters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setSearchOpen(true)}
              className="search-bar-input"
            />
          </div>

          {searchOpen && (
            <div className="search-dropdown-menu">
              <div className="search-dropdown-header">
                <span>Search results for "{searchQuery}"</span>
                <small>{searchResults.length} found</small>
              </div>
              {searchError ? (
                <div className="search-no-results" role="alert">{searchError}</div>
              ) : searchResults.length === 0 ? (
                <div className="search-no-results">
                  No matching batch IDs, parameters, or records found.
                </div>
              ) : (
                <div className="search-results-list">
                  {searchResults.map(({ entity, matchType, matchDetail }) => (
                    <button
                      key={entity.id}
                      className="search-result-row"
                      onClick={() => handleResultClick(entity.id)}
                    >
                      <div className="search-result-icon">
                        {getTypeIcon(entity.type)}
                      </div>
                      <div className="search-result-body">
                        <div className="search-result-title">
                          <strong>{entity.batch_id}</strong>
                          <span className={`type-badge-pill ${entity.type}`}>
                            {getTypeLabel(entity.type)}
                          </span>
                          {entity.status && (
                            <span className={`status-pill small ${entity.status.toLowerCase().replace(/\s+/g, '-')}`}>
                              {entity.status}
                            </span>
                          )}
                        </div>
                        <div className="search-result-detail">
                          <span className="match-tag">{matchType}:</span> {matchDetail}
                        </div>
                      </div>
                      <ArrowRight size={14} className="search-result-arrow" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Create Dropdown */}
        <div className="create-menu-container" ref={createMenuRef}>
          <button
            className="primary-button topbar-create-btn"
            onClick={() => setCreateMenuOpen(!createMenuOpen)}
            aria-label="Create batch"
            aria-haspopup="true"
            aria-expanded={createMenuOpen}
          >
            <Plus size={16} />
            <span>Create</span>
          </button>

          {createMenuOpen && (
            <div className="create-dropdown-menu">
              <button
                className="create-dropdown-item"
                onClick={() => {
                  setCreateMenuOpen(false)
                  onOpenCreateModal('flat_yarn')
                }}
              >
                <div className="create-item-icon amber">
                  <Layers size={16} />
                </div>
                <div>
                  <strong>Flat Yarn</strong>
                  <small>Record incoming material</small>
                </div>
              </button>
              <button
                className="create-dropdown-item"
                onClick={() => {
                  setCreateMenuOpen(false)
                  onOpenCreateModal('yarn')
                }}
              >
                <div className="create-item-icon blue">
                  <Cpu size={16} />
                </div>
                <div>
                  <strong>Yarn</strong>
                  <small>Allocate one Flat Yarn input</small>
                </div>
              </button>
              <button
                className="create-dropdown-item"
                onClick={() => {
                  setCreateMenuOpen(false)
                  onOpenCreateModal('rope')
                }}
              >
                <div className="create-item-icon navy">
                  <Anchor size={16} />
                </div>
                <div>
                  <strong>Rope</strong>
                  <small>Allocate Yarn inputs</small>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Storage State Indicator */}
        <div className="storage-mode-indicator" title={storageMode === 'supabase' ? 'Connected to Supabase' : 'Supabase is unavailable'}>
          {storageMode === 'supabase' ? (
            <span className="storage-mode-pill cloud">
              <Cloud size={13} /> Supabase Live
            </span>
          ) : (
            <span className="storage-mode-pill unavailable">
              <HardDrive size={13} /> Unavailable
            </span>
          )}
        </div>

        {/* User Avatar */}
        <div className="topbar-avatar" title={displayName}>
          {initials || 'OP'}
        </div>
      </div>
    </header>
  )
}
