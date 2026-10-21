import React from 'react'
import {
  ArrowLeft,
  Anchor,
  CheckCircle2,
  Cpu,
  Download,
  FileText,
  FlaskConical,
  History,
  Layers,
  Paperclip,
  Pencil,
  Wrench,
} from 'lucide-react'
import { GenealogyTree } from './GenealogyTree'

const typeLabels = {
  flat_yarn: 'Flat Yarn',
  yarn: 'Yarn',
  rope: 'Rope',
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function typeIcon(type, size = 15) {
  if (type === 'flat_yarn') return <Layers size={size} />
  if (type === 'yarn') return <Cpu size={size} />
  return <Anchor size={size} />
}

export function EntityDetail({
  entity,
  isAdmin = false,
  onBack,
  onNavigateEntity,
  onViewHistory,
  onOpenEditModal,
  onOpenAddParamModal,
  onOpenAddTestModal,
  onOpenAddProcessModal,
  onOpenUploadEvidenceModal,
  onDownloadEvidence,
  onAttachEvidence,
  onDeleteParam,
  onDeleteTest,
  onUpdateStatus,
}) {
  if (!entity) return null

  const genealogy = entity.genealogy || {
    parents: [],
    grandparents: [],
    children: [],
    grandchildren: [],
    treeEdges: [],
  }
  const parameters = entity.parameters || []
  const tests = entity.tests || []
  const processes = entity.processes || []
  const evidence = entity.evidence || []
  const auditLogs = entity.auditLogs || []

  const entries = [
    ...processes.map((item) => ({
      id: `process-${item.id}`,
      recordId: item.id,
      type: 'Process',
      className: 'process',
      icon: <Wrench size={15} />,
      title: item.process_name,
      timestamp: item.performed_at || item.created_at,
      detail: item.specification,
      remarks: item.remarks,
      actor: item.performed_by_name,
      evidenceTarget: 'process',
    })),
    ...parameters.map((item) => ({
      id: `parameter-${item.id}`,
      recordId: item.id,
      type: 'Parameter',
      className: 'parameter',
      icon: <FlaskConical size={15} />,
      title: item.name,
      timestamp: item.created_at,
      detail: `${item.value}${item.unit ? ` ${item.unit}` : ''}`,
      remarks: item.remarks,
      evidenceTarget: 'parameter',
    })),
    ...tests.map((item) => ({
      id: `test-${item.id}`,
      recordId: item.id,
      type: 'Test',
      className: 'test',
      icon: <CheckCircle2 size={15} />,
      title: item.test_name,
      timestamp: item.tested_at || item.created_at,
      detail: `${item.value}${item.unit ? ` ${item.unit}` : ''} · ${item.result || 'Pass'}${item.product_category ? ` · Category: ${item.product_category}` : ''}${item.applicable_standard ? ` · Standard: ${item.applicable_standard}` : ''}${item.process_name ? ` · Process: ${item.process_name}` : ''}`,
      remarks: item.remarks,
      actor: item.performed_by_name,
      evidenceTarget: 'test',
    })),
    ...evidence.map((item) => ({
      id: `evidence-${item.id}`,
      recordId: item.id,
      type: 'Evidence',
      className: 'evidence',
      icon: <Paperclip size={15} />,
      title: item.file_name,
      timestamp: item.created_at,
      detail: item.test_name
        ? `Evidence for test: ${item.test_name}`
        : item.parameter_name
          ? `Evidence for parameter: ${item.parameter_name}`
          : item.process_name
            ? `Evidence for process: ${item.process_name}`
            : item.mime_type || 'Batch-level document',
      actor: item.uploaded_by_name,
    })),
    ...(entity.notes ? [{
      id: `remarks-${entity.id}`,
      type: 'Remarks',
      className: 'remarks',
      icon: <FileText size={15} />,
      title: 'Batch remarks',
      timestamp: entity.created_at,
      remarks: entity.notes,
    }] : []),
  ].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0))

  const handleDownloadReport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const rows = entries.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.type)}</td>
        <td>${escapeHtml(entry.title)}</td>
        <td>${escapeHtml(entry.detail || entry.remarks || '—')}</td>
        <td>${escapeHtml(formatDateTime(entry.timestamp))}</td>
      </tr>
    `).join('')
    const html = `<!doctype html>
      <html><head><title>Namah Trace · ${escapeHtml(entity.batch_id)}</title>
      <style>
        body{font:14px Arial,sans-serif;color:#202a35;margin:36px}
        h1{margin-bottom:4px}p,small{color:#586575}
        dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        dt{font-size:11px;color:#586575;text-transform:uppercase}
        dd{margin:2px 0 0;font-weight:600}
        table{border-collapse:collapse;width:100%;margin-top:24px}
        th,td{text-align:left;padding:8px;border-bottom:1px solid #d8dce0}
      </style></head><body>
      <small>NAMAH TRACE · V1.1</small><h1>${escapeHtml(entity.batch_id)}</h1>
      <p>${escapeHtml(typeLabels[entity.type] || entity.type)} · Created ${escapeHtml(formatDate(entity.created_at))}</p>
      <dl>
        <div><dt>Status</dt><dd>${escapeHtml(entity.status || 'In Progress')}</dd></div>
        <div><dt>Recorded output</dt><dd>${escapeHtml(entity.quantity == null ? 'Unspecified' : `${entity.quantity} ${entity.unit || ''}`)}</dd></div>
        <div><dt>Consumed</dt><dd>${escapeHtml(entity.quantityConsumed == null ? 'Unknown' : `${entity.quantityConsumed} ${entity.unit || ''}`)}</dd></div>
        <div><dt>Remaining</dt><dd>${escapeHtml(entity.consumptionKnown ? `${entity.quantityRemaining} ${entity.unit}` : 'Unknown')}</dd></div>
        ${entity.supplier ? `<div><dt>Supplier</dt><dd>${escapeHtml(entity.supplier)}</dd></div>` : ''}
        ${entity.treatment ? `<div><dt>Treatment</dt><dd>${escapeHtml(entity.treatment)}</dd></div>` : ''}
      </dl>
      <h2>Lifecycle</h2><table><thead><tr><th>Type</th><th>Record</th><th>Details</th><th>Date</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No lifecycle records</td></tr>'}</tbody></table>
      </body></html>`

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 250)
  }

  const quantityDisplay = entity.quantity == null
    ? 'Unspecified'
    : `${entity.quantity} ${entity.unit || ''}`.trim()

  return (
    <div className="page detail-page">
      <div className="detail-top-nav">
        <button className="back-link-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Batches
        </button>
        <div className="detail-quick-actions">
          <button className="secondary-button" onClick={handleDownloadReport}>
            <Download size={15} /> Export
          </button>
          <button className="secondary-button" onClick={onOpenEditModal}>
            <Pencil size={15} /> Edit
          </button>
        </div>
      </div>

      <header className="detail-heading">
        <div className={`detail-type-badge ${entity.type}`}>
          {typeIcon(entity.type)}
          {typeLabels[entity.type] || entity.type}
        </div>
        <h1>{entity.batch_id}</h1>
        {entity.type === 'flat_yarn' && entity.batch_id.toUpperCase().startsWith('INTAKE-') && (
          <p className="detail-intake-note">
            Temporary intake reference · assign a batch identifier before using this material for Yarn.
          </p>
        )}
        <div className="detail-status-quantity">
          <select
            className={`status-select-control ${entity.status?.toLowerCase().replace(/\s+/g, '-')}`}
            value={entity.status || 'In Progress'}
            onChange={(event) => onUpdateStatus(event.target.value)}
            aria-label="Batch status"
          >
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
          <span className="detail-output-quantity">{quantityDisplay} output</span>
        </div>
      </header>

      <div className="detail-workspace-layout">
        <div className="detail-records-column">
      <section className="detail-basic-section" aria-labelledby="basic-heading">
        <div className="detail-section-heading">
          <div>
            <span className="eyebrow">BATCH RECORD</span>
            <h2 id="basic-heading">Basic information</h2>
          </div>
        </div>
        <div className="detail-basic-grid">
          {entity.supplier && <div><span>Supplier</span><strong>{entity.supplier}</strong></div>}
          {entity.treatment && <div><span>Treatment</span><strong>{entity.treatment}</strong></div>}
          {entity.type === 'yarn' && entity.wastage_percentage != null && (
            <div><span>Wastage estimate</span><strong>{entity.wastage_percentage}%</strong></div>
          )}
          {entity.type === 'yarn' && entity.estimated_output_quantity != null && (
            <div>
              <span>Estimated output</span>
              <strong>{entity.estimated_output_quantity} {entity.unit || ''}</strong>
            </div>
          )}
          <div><span>Created</span><strong>{formatDateTime(entity.created_at)}</strong></div>
          <div><span>Recorded by</span><strong>{entity.created_by_name || '—'}</strong></div>
          {(entity.quantity != null
            || (entity.type === 'yarn' && entity.estimated_output_quantity != null)) && (
            <>
              <div>
                <span>Consumed</span>
                <strong>{entity.quantityConsumed == null ? 'Unknown' : `${entity.quantityConsumed} ${entity.unit || ''}`.trim()}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{entity.consumptionKnown ? `${entity.quantityRemaining} ${entity.unit}` : 'Unknown'}</strong>
              </div>
            </>
          )}
          {entity.type === 'flat_yarn' && entity.critical_quantity_threshold != null && (
            <div>
              <span>Critical threshold</span>
              <strong>
                {entity.critical_quantity_threshold} {entity.critical_quantity_threshold_unit || entity.unit || 'kg'}
                {entity.lowStock
                  ? ' · Below threshold'
                  : entity.thresholdUnitProblem
                    ? ' · Alert disabled: check threshold and stock units'
                    : !entity.consumptionKnown
                      ? ' · Alert unavailable: remaining quantity is unknown'
                    : ''}
              </strong>
            </div>
          )}
          {entity.type === 'flat_yarn' && isAdmin && entity.critical_quantity_threshold == null && (
            <div>
              <span>Critical threshold</span>
              <strong>Not set · configure with Edit</strong>
            </div>
          )}
        </div>
      </section>

      <section className="detail-lifecycle">
        <div className="detail-section-heading lifecycle-heading">
          <div>
            <span className="eyebrow">BATCH RECORD</span>
            <h2>Lifecycle <span>{entries.length}</span></h2>
          </div>
          <div className="lifecycle-actions">
            <button className="secondary-button" onClick={onOpenAddProcessModal}>Process</button>
            <button className="secondary-button" onClick={onOpenAddParamModal}>Parameter</button>
            <button className="secondary-button" onClick={onOpenAddTestModal}>Test</button>
            <button className="secondary-button" onClick={onOpenUploadEvidenceModal}>Evidence</button>
          </div>
        </div>

        {entries.length > 0 ? (
          <div className="unified-timeline">
            {entries.map((entry) => (
              <article className={`timeline-entry ${entry.className}`} key={entry.id}>
                <span className="timeline-entry-icon">{entry.icon}</span>
                <div className="timeline-entry-main">
                  <div className="timeline-entry-heading">
                    <span className={`timeline-type ${entry.className}`}>{entry.type}</span>
                    <time>{formatDateTime(entry.timestamp)}</time>
                  </div>
                  <h3>{entry.title}</h3>
                  {entry.detail && (
                    <p className="timeline-entry-detail">{entry.detail}</p>
                  )}
                  {entry.className === 'evidence' && (
                    <button
                      type="button"
                      className="timeline-evidence-link"
                      onClick={() => onDownloadEvidence?.(entry.recordId)}
                    >
                      <Download size={13} /> Download evidence
                    </button>
                  )}
                  {entry.remarks && <p className="timeline-entry-remarks">{entry.remarks}</p>}
                  {entry.actor && <span className="timeline-entry-actor">{entry.actor}</span>}
                  {entry.evidenceTarget && (
                    <button
                      type="button"
                      className="timeline-evidence-link"
                      onClick={() => onAttachEvidence?.(entry.evidenceTarget, entry.recordId)}
                    >
                      <Paperclip size={13} /> Attach evidence
                    </button>
                  )}
                  {isAdmin && entry.className === 'parameter' && (
                    <button
                      className="timeline-delete-action"
                      onClick={() => onDeleteParam(entry.recordId, entry.title)}
                    >
                      Remove parameter
                    </button>
                  )}
                  {isAdmin && entry.className === 'test' && (
                    <button
                      className="timeline-delete-action"
                      onClick={() => onDeleteTest(entry.recordId, entry.title)}
                    >
                      Delete test
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="detail-empty-state">No lifecycle records have been added.</p>
        )}
      </section>
        </div>

        <aside className="detail-genealogy-panel" aria-labelledby="genealogy-heading">
          <header>
            <h2 id="genealogy-heading">Genealogy</h2>
          </header>
          <GenealogyTree
            entityId={entity.id}
            edges={genealogy.treeEdges}
            onNavigateEntity={onNavigateEntity}
          />
        </aside>
      </div>

      <details className="detail-history">
        <summary><History size={15} /> View History <span>{auditLogs.length}</span></summary>
        {auditLogs.length > 0 ? (
          <div className="history-list">
            {auditLogs.map((log) => (
              <article className="history-row" key={log.id}>
                <div><strong>{log.action}</strong><time>{formatDateTime(log.created_at)}</time></div>
                {log.new_value && (
                  <p>{log.old_value ? `${log.old_value} → ` : ''}{log.new_value}</p>
                )}
                <small>{log.performed_by_name || '—'}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="detail-empty-state">No history recorded.</p>
        )}
        {onViewHistory && (
          <button className="text-action history-global-link" onClick={onViewHistory}>
            Open all history
          </button>
        )}
      </details>

    </div>
  )
}
