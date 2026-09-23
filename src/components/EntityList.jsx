import React, { useState } from 'react'
import {
  Layers,
  Cpu,
  Anchor,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle2,
  Calendar,
  Building2,
  Wrench,
  Scale,
} from 'lucide-react'

export function EntityList({
  type,
  entities,
  onSelectEntity,
  onOpenCreateModal,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL', 'In Progress', 'Completed'

  const getTitle = () => {
    if (type === 'flat_yarn') return 'Flat Yarn Batches'
    if (type === 'yarn') return 'Yarn Batches'
    if (type === 'rope') return 'Rope Batches'
    return 'All Manufactured Batches'
  }

  const getSubtitle = () => {
    if (type === 'flat_yarn') return 'Incoming source raw material received from suppliers'
    if (type === 'yarn') return 'Treated, twisted, and heat-set lots derived from flat yarn'
    if (type === 'rope') return 'Finished braided kernmantle ropes assembled from yarn batches'
    return 'Comprehensive operational ledger across all manufacturing tiers'
  }

  const getTypeIcon = () => {
    if (type === 'flat_yarn') return <Layers size={22} className="text-amber" />
    if (type === 'yarn') return <Cpu size={22} className="text-blue" />
    return <Anchor size={22} className="text-navy" />
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Filter entities
  const filtered = entities.filter((item) => {
    // Type filter
    if (type && item.type !== type) return false

    // Status filter
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      const matchBatch = item.batch_id.toLowerCase().includes(q)
      const matchSupplier = item.supplier && item.supplier.toLowerCase().includes(q)
      const matchTreatment = item.treatment && item.treatment.toLowerCase().includes(q)
      const matchNotes = item.notes && item.notes.toLowerCase().includes(q)
      return matchBatch || matchSupplier || matchTreatment || matchNotes
    }

    return true
  })

  return (
    <div className="page list-page">
      {/* List Page Header */}
      <div className="list-page-header">
        <div className="list-header-left">
          <div className="list-type-badge-icon">
            {getTypeIcon()}
          </div>
          <div>
            <p className="eyebrow">OPERATIONAL LEDGER</p>
            <h1>{getTitle()}</h1>
            <p className="subheading">{getSubtitle()}</p>
          </div>
        </div>

        <button
          className="primary-button create-button-header"
          onClick={() => onOpenCreateModal(type || 'flat_yarn')}
        >
          <Plus size={16} /> + New {type === 'flat_yarn' ? 'Flat Yarn' : type === 'yarn' ? 'Yarn Batch' : 'Rope Batch'}
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="table-controls-bar">
        <div className="search-field-expanded">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder={`Search ${getTitle().toLowerCase()} by ID, supplier, treatment...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>

        <div className="status-filter-pills">
          <button
            className={`filter-pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All ({entities.filter((e) => !type || e.type === type).length})
          </button>
          <button
            className={`filter-pill-btn ${statusFilter === 'In Progress' ? 'active' : ''}`}
            onClick={() => setStatusFilter('In Progress')}
          >
            In Progress
          </button>
          <button
            className={`filter-pill-btn ${statusFilter === 'Completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('Completed')}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Desktop Data Table / Mobile Responsive Cards */}
      <div className="entity-table-wrapper">
        <div className="entity-table-header">
          <span className="col-id">Batch ID</span>
          <span className="col-specifics">
            {type === 'flat_yarn' ? 'Supplier' : type === 'yarn' ? 'Treatment / Process' : 'Composition / Output'}
          </span>
          <span className="col-quantity">Quantity</span>
          <span className="col-status">Status</span>
          <span className="col-updated">Created / Updated</span>
          <span className="col-action"></span>
        </div>

        <div className="entity-rows-container">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="entity-row-item"
              onClick={() => onSelectEntity(item.id)}
            >
              {/* Batch ID */}
              <div className="cell-id">
                <div className={`batch-id-badge ${item.type}`}>
                  {item.batch_id}
                </div>
                <span className="mobile-only-type-tag">
                  {item.type === 'flat_yarn' ? 'Flat Yarn' : item.type === 'yarn' ? 'Yarn Batch' : 'Rope Batch'}
                </span>
              </div>

              {/* Specifics (Supplier / Treatment / Output) */}
              <div className="cell-specifics">
                {item.type === 'flat_yarn' && (
                  <div className="specifics-row">
                    <Building2 size={14} className="cell-icon" />
                    <strong>{item.supplier || 'Unspecified supplier'}</strong>
                  </div>
                )}
                {item.type === 'yarn' && (
                  <div className="specifics-row">
                    <Wrench size={14} className="cell-icon" />
                    <strong>{item.treatment || 'Standard processing'}</strong>
                  </div>
                )}
                {item.type === 'rope' && (
                  <div className="specifics-row">
                    <Anchor size={14} className="cell-icon" />
                    <strong>{item.notes ? item.notes.slice(0, 45) + '...' : 'Finished rope assembly'}</strong>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="cell-quantity">
                {item.quantity ? (
                  <span className="quantity-tag">
                    <Scale size={13} className="cell-icon" />
                    {item.quantity} {item.unit || (item.type === 'rope' ? 'm' : 'kg')}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>

              {/* Status */}
              <div className="cell-status">
                <span className={`status-pill ${item.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                  <span className="status-dot"></span>
                  {item.status || 'Active'}
                </span>
              </div>

              {/* Date */}
              <div className="cell-updated">
                <span>{formatDate(item.updated_at || item.created_at)}</span>
                <small>{item.created_by_name || 'Operator'}</small>
              </div>

              {/* Action */}
              <div className="cell-action">
                <button
                  className="row-open-button"
                  aria-label={`Open batch ${item.batch_id}`}
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="empty-state-card">
              <p>No batches found matching your search or filters.</p>
              <button
                className="secondary-button"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('ALL')
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
