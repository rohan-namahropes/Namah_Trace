import React, { useState } from 'react'
import { History, Search, Filter, Calendar, User, ArrowRight } from 'lucide-react'

export function AuditTrailView({ auditLogs, onSelectEntity }) {
  const [search, setSearch] = useState('')

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const filtered = auditLogs.filter((log) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      log.action.toLowerCase().includes(q) ||
      (log.batch_id && log.batch_id.toLowerCase().includes(q)) ||
      (log.performed_by_name && log.performed_by_name.toLowerCase().includes(q)) ||
      (log.new_value && log.new_value.toLowerCase().includes(q))
    )
  })

  return (
    <div className="page audit-page">
      <div className="list-page-header">
        <div className="list-header-left">
          <div className="list-type-badge-icon navy">
            <History size={22} className="text-navy" />
          </div>
          <div>
            <p className="eyebrow">COMPLIANCE & TRACEABILITY</p>
            <h1>Global Audit Trail</h1>
            <p className="subheading">
              Complete chronological audit stream of all manufacturing updates, parameter registrations, process operations, and status changes.
            </p>
          </div>
        </div>
      </div>

      <div className="table-controls-bar">
        <div className="search-field-expanded">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search audit trail by batch ID, action, user, or value..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch('')}>
              ×
            </button>
          )}
        </div>
      </div>

      <div className="audit-ledger-card">
        {filtered.map((log) => (
          <div key={log.id} className="audit-ledger-row">
            <div className="ledger-time-col">
              <strong>{formatDate(log.created_at)}</strong>
              <small>{formatTime(log.created_at)}</small>
            </div>

            <div className="ledger-main-col">
              <div className="ledger-action-line">
                <span className="ledger-action-title">{log.action}</span>
                {log.batch_id && (
                  <button
                    className="ledger-batch-tag"
                    onClick={() => log.entity_id && onSelectEntity(log.entity_id)}
                  >
                    Batch: <strong>{log.batch_id}</strong>
                    <ArrowRight size={11} />
                  </button>
                )}
              </div>

              {log.new_value && (
                <div className="ledger-diff-detail">
                  {log.old_value && (
                    <span className="diff-was">
                      Was: <code>{log.old_value}</code> →
                    </span>
                  )}
                  <span className="diff-now">
                    Now: <code>{log.new_value}</code>
                  </span>
                </div>
              )}
            </div>

            <div className="ledger-user-col">
              <span className="ledger-user-name">
                <User size={13} /> {log.performed_by_name || 'Operator'}
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="empty-state-card">
            No audit records match "{search}".
          </div>
        )}
      </div>
    </div>
  )
}
