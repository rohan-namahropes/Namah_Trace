import React from 'react'
import {
  Layers,
  Cpu,
  Anchor,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  GitBranch,
  ShieldCheck,
  FileText,
} from 'lucide-react'

export function Dashboard({
  entities,
  auditLogs,
  onSelectEntity,
  onOpenCreateModal,
  onNavigateView,
}) {
  const flatYarns = entities.filter((e) => e.type === 'flat_yarn')
  const yarns = entities.filter((e) => e.type === 'yarn')
  const ropes = entities.filter((e) => e.type === 'rope')

  const inProgressCount = entities.filter((e) => e.status === 'In Progress').length
  const completedCount = entities.filter((e) => e.status === 'Completed').length

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="page dashboard-page">
      {/* Hero / Operational Title Banner */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <p className="eyebrow">NAMAH Trace · INTERNAL MANUFACTURING WORKSPACE</p>
          <h1 className="dashboard-title">Traceability Matrix</h1>
          <p className="dashboard-subtitle">
            Flat Yarn to Yarn Batch to Rope Batch. Every lot, parameter, and genealogical link recorded.
          </p>
        </div>

        {/* Quick Create Buttons Bar */}
        <div className="hero-quick-actions">
          <button
            className="primary-button create-pill-btn amber"
            onClick={() => onOpenCreateModal('flat_yarn')}
          >
            <Plus size={16} /> + New Flat Yarn
          </button>
          <button
            className="primary-button create-pill-btn blue"
            onClick={() => onOpenCreateModal('yarn')}
          >
            <Plus size={16} /> + New Yarn Batch
          </button>
          <button
            className="primary-button create-pill-btn navy"
            onClick={() => onOpenCreateModal('rope')}
          >
            <Plus size={16} /> + New Rope Batch
          </button>
        </div>
      </div>

      {/* Operational KPI Stats Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">FLAT YARN BATCHES</span>
            <div className="metric-icon-wrap amber">
              <Layers size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <strong className="metric-number">{flatYarns.length.toString().padStart(2, '0')}</strong>
            <span className="metric-unit">Raw sources</span>
          </div>
          <p className="metric-caption">Incoming supplier materials (e.g. 523)</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">DERIVED YARN BATCHES</span>
            <div className="metric-icon-wrap blue">
              <Cpu size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <strong className="metric-number">{yarns.length.toString().padStart(2, '0')}</strong>
            <span className="metric-unit">Processed strands</span>
          </div>
          <p className="metric-caption">Twisted, spun & heat-set lots (e.g. 523 TA)</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">FINISHED ROPE BATCHES</span>
            <div className="metric-icon-wrap navy">
              <Anchor size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <strong className="metric-number">{ropes.length.toString().padStart(2, '0')}</strong>
            <span className="metric-unit">Manufactured ropes</span>
          </div>
          <p className="metric-caption">Braided & kernmantle output (e.g. 5417)</p>
        </div>
        {/*
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">IN PROGRESS RUNS</span>
            <div className="metric-icon-wrap orange">
              <Clock size={18} />
            </div>
          </div>
          <div className="metric-value-row">
            <strong className="metric-number">{inProgressCount.toString().padStart(2, '0')}</strong>
            <span className="metric-unit">Active</span>
          </div>
          <p className="metric-caption">{completedCount} batches marked completed</p>
        </div>
*/}
      </div>

      {/* The 3 Core Entity Tiers (Visual Matrix) */}
      <div className="matrix-columns-section">
        <div className="section-title-bar">
          <div>
            <h2>Batch Overview</h2>
            <p>Direct lineage flows from Flat Yarn into Yarn Batches and combines into Rope Batches.</p>
          </div>
        </div>

        <div className="tier-columns-grid">
          {/* Tier 1: Rope Batches (Finished Goods — shown first) */}
          <div className="tier-column">
            <div className="tier-column-head navy-border">
              <div className="tier-title-wrap">
                <span className="tier-step-num">1</span>
                <div>
                  <h3>Rope Batches</h3>
                  <small>Finished Braided Material</small>
                </div>
              </div>
              <button
                className="tier-view-all-btn"
                onClick={() => onNavigateView('rope')}
              >
                View all ({ropes.length}) <ArrowRight size={13} />
              </button>
            </div>

            <div className="tier-cards-list">
              {ropes.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="tier-item-card"
                  onClick={() => onSelectEntity(item.id)}
                >
                  <div className="tier-item-top">
                    <div className="tier-batch-id-badge navy">
                      {item.batch_id}
                    </div>
                    <span className={`status-pill ${item.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                      {item.status || 'Active'}
                    </span>
                  </div>
                  <div className="tier-item-info">
                    <div className="info-kv">
                      <span>Quantity:</span>
                      <strong>{item.quantity ? `${item.quantity} ${item.unit || 'm'}` : 'In Production'}</strong>
                    </div>
                    {item.notes && (
                      <div className="info-kv notes-line">
                        <small>{item.notes.slice(0, 48)}...</small>
                      </div>
                    )}
                  </div>
                  <div className="tier-item-footer">
                    <small>Updated {formatTimeAgo(item.updated_at || item.created_at)}</small>
                    <ArrowRight size={14} className="hover-arrow" />
                  </div>
                </div>
              ))}
              {ropes.length === 0 && (
                <div className="tier-empty-card">No rope batches recorded yet.</div>
              )}
            </div>
          </div>

          {/* Tier 2: Yarn Batches */}
          <div className="tier-column">
            <div className="tier-column-head blue-border">
              <div className="tier-title-wrap">
                <span className="tier-step-num">2</span>
                <div>
                  <h3>Yarn Batches</h3>
                  <small>Derived Processed Lots</small>
                </div>
              </div>
              <button
                className="tier-view-all-btn"
                onClick={() => onNavigateView('yarn')}
              >
                View all ({yarns.length}) <ArrowRight size={13} />
              </button>
            </div>

            <div className="tier-cards-list">
              {yarns.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="tier-item-card"
                  onClick={() => onSelectEntity(item.id)}
                >
                  <div className="tier-item-top">
                    <div className="tier-batch-id-badge blue">
                      {item.batch_id}
                    </div>
                    <span className={`status-pill ${item.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                      {item.status || 'Active'}
                    </span>
                  </div>
                  <div className="tier-item-info">
                    <div className="info-kv">
                      <span>Treatment:</span>
                      <strong>{item.treatment || 'Standard'}</strong>
                    </div>
                    {item.quantity && (
                      <div className="info-kv">
                        <span>Quantity:</span>
                        <span>{item.quantity} {item.unit || 'kg'}</span>
                      </div>
                    )}
                  </div>
                  <div className="tier-item-footer">
                    <small>Updated {formatTimeAgo(item.updated_at || item.created_at)}</small>
                    <ArrowRight size={14} className="hover-arrow" />
                  </div>
                </div>
              ))}
              {yarns.length === 0 && (
                <div className="tier-empty-card">No yarn batches created yet.</div>
              )}
            </div>
          </div>

          {/* Tier 3: Flat Yarn */}
          <div className="tier-column">
            <div className="tier-column-head amber-border">
              <div className="tier-title-wrap">
                <span className="tier-step-num">3</span>
                <div>
                  <h3>Flat Yarn Batches</h3>
                  <small>Incoming Raw Material</small>
                </div>
              </div>
              <button
                className="tier-view-all-btn"
                onClick={() => onNavigateView('flat_yarn')}
              >
                View all ({flatYarns.length}) <ArrowRight size={13} />
              </button>
            </div>

            <div className="tier-cards-list">
              {flatYarns.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="tier-item-card"
                  onClick={() => onSelectEntity(item.id)}
                >
                  <div className="tier-item-top">
                    <div className="tier-batch-id-badge amber">
                      {item.batch_id}
                    </div>
                    <span className={`status-pill ${item.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                      {item.status || 'Active'}
                    </span>
                  </div>
                  <div className="tier-item-info">
                    <div className="info-kv">
                      <span>Supplier:</span>
                      <strong>{item.supplier || 'Unspecified'}</strong>
                    </div>
                    {item.quantity && (
                      <div className="info-kv">
                        <span>Quantity:</span>
                        <span>{item.quantity} {item.unit || 'kg'}</span>
                      </div>
                    )}
                  </div>
                  <div className="tier-item-footer">
                    <small>Updated {formatTimeAgo(item.updated_at || item.created_at)}</small>
                    <ArrowRight size={14} className="hover-arrow" />
                  </div>
                </div>
              ))}
              {flatYarns.length === 0 && (
                <div className="tier-empty-card">No flat yarn batches registered yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Operational Audit Activity Stream */}
      <div className="dashboard-audit-section">
        <div className="section-title-bar">
          <div>
            <h2>Recent Activity</h2>
            <p>Chronological audit log of material additions, parameters, and status updates.</p>
          </div>
        </div>

        <div className="activity-timeline-card">
          {auditLogs.slice(0, 6).map((log) => (
            <div key={log.id} className="activity-timeline-item">
              <div className="activity-timeline-marker"></div>
              <div className="activity-item-content">
                <div className="activity-item-header">
                  <strong>{log.action}</strong>
                  <time>{formatDate(log.created_at)} · {formatTimeAgo(log.created_at)}</time>
                </div>
                <div className="activity-item-meta">
                  {log.batch_id && (
                    <span className="activity-batch-badge">
                      Batch: {log.batch_id}
                    </span>
                  )}
                  {log.new_value && (
                    <span className="activity-details-text">
                      {log.old_value ? `Changed from "${log.old_value}" to "${log.new_value}"` : log.new_value}
                    </span>
                  )}
                  <span className="activity-actor-name">
                    by {log.performed_by_name || 'System Operator'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="empty-state">No recent activity recorded.</div>
          )}
        </div>
      </div>
    </div>
  )
}
