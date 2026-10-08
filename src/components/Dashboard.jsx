import React from 'react'
import { Anchor, ArrowRight, Cpu, History, Layers } from 'lucide-react'

const batchTypes = [
  { type: 'rope', label: 'Rope batches', icon: Anchor },
  { type: 'yarn', label: 'Yarn batches', icon: Cpu },
  { type: 'flat_yarn', label: 'Flat Yarn batches', icon: Layers },
]

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Dashboard({ entities, auditLogs, onSelectEntity, onNavigateView }) {
  const recentActivity = [...auditLogs]
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
    .slice(0, 6)

  return (
    <div className="page dashboard-v3">
      <header className="dashboard-v3-heading">
        <div>
          <p className="eyebrow">NAMAH TRACE · V1.1</p>
          <h1>Production overview</h1>
          <p>Current batch status and latest recorded activity.</p>
        </div>
        <button
          className="dashboard-v3-history-link"
          type="button"
          onClick={() => onNavigateView('audit')}
        >
          <History size={15} /> Full history
        </button>
      </header>

      <section className="dashboard-v3-status" aria-label="Batch counts by product type">
        {batchTypes.map(({ type, label, icon: Icon }) => (
          <button
            className={`dashboard-v3-stat ${type}`}
            key={type}
            type="button"
            onClick={() => onNavigateView(type)}
            aria-label={`Open ${label}`}
          >
            <span className="dashboard-v3-stat-icon"><Icon size={17} /></span>
            <span className="dashboard-v3-stat-content">
              <small>{label}</small>
              <strong>{entities.filter((entity) => entity.type === type).length}</strong>
              <span className="dashboard-v3-stat-breakdown">
                {entities.filter((entity) => entity.type === type && entity.status === 'In Progress').length} in progress
                <span aria-hidden="true"> · </span>
                {entities.filter((entity) => entity.type === type && entity.status === 'Completed').length} completed
              </span>
            </span>
            <ArrowRight size={15} className="dashboard-v3-stat-arrow" />
          </button>
        ))}
      </section>

      <section className="dashboard-v3-activity" aria-labelledby="dashboard-activity-heading">
        <header className="dashboard-v3-section-heading">
          <div>
            <h2 id="dashboard-activity-heading">Latest activity</h2>
            <span>Most recent updates across batches</span>
          </div>
          <button type="button" onClick={() => onNavigateView('audit')}>
            View history <ArrowRight size={14} />
          </button>
        </header>

        {recentActivity.length ? (
          <div className="dashboard-v3-activity-list">
            {recentActivity.map((log) => (
              <button
                className="dashboard-v3-activity-row"
                key={log.id}
                type="button"
                disabled={!log.entity_id}
                onClick={() => log.entity_id && onSelectEntity(log.entity_id)}
              >
                <span className="dashboard-v3-activity-marker" aria-hidden="true" />
                <span className="dashboard-v3-activity-description">
                  <strong>{log.action}</strong>
                  <small>
                    {log.batch_id || 'Batch'} · {log.performed_by_name || 'Operator'}
                  </small>
                </span>
                <time>{formatDate(log.created_at)}</time>
                {log.entity_id && <ArrowRight size={14} />}
              </button>
            ))}
          </div>
        ) : (
          <p className="dashboard-v3-empty">No activity has been recorded yet.</p>
        )}
      </section>
    </div>
  )
}
