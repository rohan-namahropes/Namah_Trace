import React, { useState } from 'react'
import {
  ArrowLeft,
  Layers,
  Cpu,
  Anchor,
  Edit2,
  Plus,
  Trash2,
  Download,
  Calendar,
  User,
  Scale,
  Building2,
  Wrench,
  CheckCircle2,
  Clock,
  FileText,
  Paperclip,
  GitBranch,
  History,
  FlaskConical,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react'

export function EntityDetail({
  entity,
  onBack,
  onNavigateEntity,
  onOpenEditModal,
  onOpenAddParamModal,
  onOpenAddTestModal,
  onOpenAddProcessModal,
  onOpenUploadEvidenceModal,
  onDeleteParam,
  onDeleteTest,
  onUpdateStatus,
}) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'genealogy', 'processes', 'qc', 'evidence', 'audit'

  if (!entity) return null

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  }

  const getTypeIcon = (type = entity.type) => {
    if (type === 'flat_yarn') return <Layers size={18} className="text-amber" />
    if (type === 'yarn') return <Cpu size={18} className="text-blue" />
    return <Anchor size={18} className="text-navy" />
  }

  const getTypeLabel = (type = entity.type) => {
    if (type === 'flat_yarn') return 'Flat Yarn Batch'
    if (type === 'yarn') return 'Yarn Batch'
    return 'Rope Batch'
  }

  // Print/Download summary report
  const handleDownloadReport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Namah Trace Report - Batch ${entity.batch_id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; line-height: 1.5; }
            .header { border-bottom: 2px solid #004282; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .logo-text { font-size: 24px; font-weight: 700; color: #004282; }
            .logo-sub { font-size: 11px; letter-spacing: 1px; color: #64748b; }
            .title { font-size: 28px; margin: 10px 0 0; color: #0f172a; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #e2e8f0; }
            .section { margin-top: 30px; }
            .section-title { font-size: 16px; font-weight: 700; color: #004282; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background: #f1f5f9; }
            .timeline-item { border-left: 2px solid #004282; padding-left: 14px; margin-bottom: 14px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; }
            .meta-item { background: #f8fafc; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo-text">NAMAH ROPES</div>
              <div class="logo-sub">OFFICIAL TRACEABILITY DOSSIER · V1</div>
              <h1 class="title">Batch ${entity.batch_id}</h1>
            </div>
            <div>
              <span class="badge">${getTypeLabel()}</span>
              <div style="margin-top:6px; font-size:12px; color:#64748b;">Generated: ${new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><strong>Status:</strong> ${entity.status || 'In Progress'}</div>
            <div class="meta-item"><strong>Quantity:</strong> ${entity.quantity ? `${entity.quantity} ${entity.unit || ''}` : 'Unspecified'}</div>
            ${entity.supplier ? `<div class="meta-item"><strong>Supplier:</strong> ${entity.supplier}</div>` : ''}
            ${entity.treatment ? `<div class="meta-item"><strong>Treatment:</strong> ${entity.treatment}</div>` : ''}
            <div class="meta-item"><strong>Created:</strong> ${formatDate(entity.created_at)} by ${entity.created_by_name || 'Operator'}</div>
            <div class="meta-item"><strong>Updated:</strong> ${formatDate(entity.updated_at || entity.created_at)}</div>
          </div>

          ${entity.notes ? `
            <div class="section">
              <div class="section-title">Remarks & Observations</div>
              <p style="font-size: 13px;">${entity.notes}</p>
            </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Genealogy Lineage</div>
            ${entity.genealogy.parents.length ? `
              <p><strong>Parents:</strong> ${entity.genealogy.parents.map(p => `${p.batchId} (${p.type})`).join(', ')}</p>
            ` : '<p>Original Raw Material (No parents)</p>'}
            ${entity.genealogy.children.length ? `
              <p><strong>Derived Downstream Batches:</strong> ${entity.genealogy.children.map(c => `${c.batchId} (${c.type})`).join(', ')}</p>
            ` : ''}
          </div>

          ${entity.parameters.length ? `
            <div class="section">
              <div class="section-title">Parameters & Specifications</div>
              <table>
                <thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Remarks</th></tr></thead>
                <tbody>
                  ${entity.parameters.map(p => `<tr><td>${p.name}</td><td><strong>${p.value}</strong></td><td>${p.unit || '-'}</td><td>${p.remarks || '-'}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${entity.tests.length ? `
            <div class="section">
              <div class="section-title">QC Tests & Observations</div>
              <table>
                <thead><tr><th>Test</th><th>Measurement</th><th>Result</th><th>Performed By</th></tr></thead>
                <tbody>
                  ${entity.tests.map(t => `<tr><td>${t.test_name}</td><td>${t.value} ${t.unit || ''}</td><td><strong>${t.result}</strong></td><td>${t.performed_by_name || '-'}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${entity.processes.length ? `
            <div class="section">
              <div class="section-title">Manufacturing Lifecycle Processes</div>
              ${entity.processes.map(pr => `
                <div class="timeline-item">
                  <strong>${pr.process_name}</strong> - ${pr.specification || 'Standard specification'}
                  <div style="font-size:11px; color:#64748b; margin-top:2px;">
                    Performed: ${formatDate(pr.performed_at || pr.created_at)} by ${pr.performed_by_name || 'Operator'}
                  </div>
                  ${pr.remarks ? `<div style="font-size:12px; margin-top:4px;">${pr.remarks}</div>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 11px; color: #94a3b8; text-align: center;">
            Namah Trace Internal Traceability System · Scale New Heights
          </div>
        </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 250)
  }

  const { genealogy } = entity

  return (
    <div className="page detail-page">
      {/* Top Back Navigation Bar */}
      <div className="detail-top-nav">
        <button className="back-link-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to batches
        </button>

        <div className="detail-quick-actions">
          <button className="secondary-button" onClick={handleDownloadReport}>
            <Download size={15} /> Export Dossier
          </button>
          <button className="secondary-button" onClick={onOpenEditModal}>
            <Edit2 size={15} /> Edit Basic Info
          </button>
        </div>
      </div>

      {/* Main Entity Header Banner */}
      <div className="detail-hero-banner">
        <div className="detail-hero-left">
          <div className="detail-type-row">
            <span className={`detail-type-badge ${entity.type}`}>
              {getTypeIcon()}
              {getTypeLabel()}
            </span>

            {/* Quick Status Dropdown / Pill */}
            <div className="status-dropdown-wrap">
              <select
                className={`status-select-control ${entity.status?.toLowerCase().replace(/\s+/g, '-')}`}
                value={entity.status || 'In Progress'}
                onChange={(e) => onUpdateStatus(e.target.value)}
              >
                <option value="In Progress">Status: In Progress</option>
                <option value="Completed">Status: Completed</option>
              </select>
            </div>
          </div>

          <h1 className="detail-batch-title">{entity.batch_id}</h1>

          <div className="detail-meta-pills">
            {entity.supplier && (
              <span className="meta-pill">
                <Building2 size={14} /> Supplier: <strong>{entity.supplier}</strong>
              </span>
            )}
            {entity.treatment && (
              <span className="meta-pill">
                <Wrench size={14} /> Treatment: <strong>{entity.treatment}</strong>
              </span>
            )}
            {entity.quantity && (
              <span className="meta-pill">
                <Scale size={14} /> Quantity: <strong>{entity.quantity} {entity.unit || (entity.type === 'rope' ? 'm' : 'kg')}</strong>
              </span>
            )}
            <span className="meta-pill">
              <Calendar size={14} /> Created: {formatDate(entity.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Detail Section Tabs */}
      <div className="detail-tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Info size={16} /> Overview & Genealogy
        </button>
        <button
          className={`tab-btn ${activeTab === 'processes' ? 'active' : ''}`}
          onClick={() => setActiveTab('processes')}
        >
          <Clock size={16} /> Processes ({entity.processes.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'qc' ? 'active' : ''}`}
          onClick={() => setActiveTab('qc')}
        >
          <FlaskConical size={16} /> Parameters & Tests ({entity.parameters.length + entity.tests.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setActiveTab('evidence')}
        >
          <Paperclip size={16} /> Evidence ({entity.evidence.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <History size={16} /> Audit Trail ({entity.auditLogs.length})
        </button>
      </div>

      {/* TAB CONTENT 1: OVERVIEW & GENEALOGY */}
      {activeTab === 'overview' && (
        <div className="tab-pane-content">
          <div className="detail-cards-grid">
            {/* Basic Info Card */}
            <div className="panel-card">
              <div className="panel-head">
                <div className="panel-title-wrap">
                  <FileText size={17} className="panel-icon" />
                  <h3>Basic Information</h3>
                </div>
                <button className="link-button" onClick={onOpenEditModal}>
                  Edit
                </button>
              </div>

              <div className="panel-body">
                <div className="info-attribute-grid">
                  <div className="attr-item">
                    <span className="attr-label">Batch Identifier</span>
                    <strong className="attr-value mono">{entity.batch_id}</strong>
                  </div>
                  <div className="attr-item">
                    <span className="attr-label">Entity Classification</span>
                    <span className="attr-value">{getTypeLabel()}</span>
                  </div>
                  {entity.supplier && (
                    <div className="attr-item">
                      <span className="attr-label">Raw Material Supplier</span>
                      <strong className="attr-value">{entity.supplier}</strong>
                    </div>
                  )}
                  {entity.treatment && (
                    <div className="attr-item">
                      <span className="attr-label">Treatment Specification</span>
                      <strong className="attr-value">{entity.treatment}</strong>
                    </div>
                  )}
                  <div className="attr-item">
                    <span className="attr-label">Recorded Quantity</span>
                    <span className="attr-value">
                      {entity.quantity ? `${entity.quantity} ${entity.unit || (entity.type === 'rope' ? 'm' : 'kg')}` : 'Unspecified portion'}
                    </span>
                  </div>
                  <div className="attr-item">
                    <span className="attr-label">Lifecycle Status</span>
                    <span className={`status-pill ${entity.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                      <span className="status-dot"></span>
                      {entity.status || 'Active'}
                    </span>
                  </div>
                  <div className="attr-item">
                    <span className="attr-label">Created By</span>
                    <span className="attr-value">{entity.created_by_name || 'Production Operator'}</span>
                  </div>
                  <div className="attr-item">
                    <span className="attr-label">Registered Timestamp</span>
                    <span className="attr-value">{formatDateTime(entity.created_at)}</span>
                  </div>
                </div>

                {entity.notes && (
                  <div className="entity-notes-box">
                    <span className="notes-box-title">Remarks & Observations</span>
                    <p>{entity.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* VISUAL & INTERACTIVE GENEALOGY CARD */}
            <div className="panel-card genealogy-panel">
              <div className="panel-head">
                <div className="panel-title-wrap">
                  <GitBranch size={17} className="panel-icon text-navy" />
                  <h3>Genealogy & Material Lineage</h3>
                </div>
              </div>

              <div className="panel-body">
                {/* Visual Lineage Flow Box */}
                <div className="genealogy-flow-container">
                  {/* UPSTREAM PARENTS (WHERE DID THIS COME FROM?) */}
                  <div className="genealogy-section">
                    <div className="genealogy-section-title">
                      <span>UPSTREAM PARENT ENTITIES</span>
                      <small>Source materials used to produce this batch</small>
                    </div>

                    {genealogy.parents.length > 0 ? (
                      <div className="genealogy-cards-row">
                        {genealogy.parents.map((p) => (
                          <div
                            key={p.entityId}
                            className="genealogy-node-card clickable"
                            onClick={() => onNavigateEntity(p.entityId)}
                          >
                            <div className="node-card-top">
                              <span className={`type-badge-pill ${p.type}`}>
                                {getTypeIcon(p.type)}
                                {p.type === 'flat_yarn' ? 'Flat Yarn' : 'Yarn Batch'}
                              </span>
                              <ExternalLink size={14} className="node-link-icon" />
                            </div>
                            <strong className="node-batch-id">{p.batchId}</strong>
                            {p.supplier && <div className="node-meta">Supplier: {p.supplier}</div>}
                            {p.treatment && <div className="node-meta">{p.treatment}</div>}
                            {p.quantityUsed && (
                              <div className="node-portion-tag">
                                Portion: {p.quantityUsed} {p.unit || 'kg'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="genealogy-root-notice">
                        <span className="root-dot"></span>
                        <span>This is a primary source Flat Yarn batch (Origin Material).</span>
                      </div>
                    )}
                  </div>

                  {/* CURRENT ENTITY FOCAL NODE */}
                  <div className="genealogy-focus-node">
                    <div className="focus-flow-arrow">↓</div>
                    <div className="focus-node-box">
                      <div className="focus-badge-row">
                        <span className={`type-badge-pill ${entity.type}`}>
                          {getTypeIcon()}
                          {getTypeLabel()}
                        </span>
                        <span className="focus-current-tag">CURRENT BATCH</span>
                      </div>
                      <h2 className="focus-title">{entity.batch_id}</h2>
                      <div className="focus-details">
                        {entity.supplier && <span>Supplier: {entity.supplier}</span>}
                        {entity.treatment && <span>Treatment: {entity.treatment}</span>}
                        {entity.quantity && <span>{entity.quantity} {entity.unit}</span>}
                      </div>
                    </div>
                    <div className="focus-flow-arrow">↓</div>
                  </div>

                  {/* DOWNSTREAM DERIVATIVES / CHILDREN (USED IN WHAT?) */}
                  <div className="genealogy-section">
                    <div className="genealogy-section-title">
                      <span>DOWNSTREAM DERIVED ENTITIES</span>
                      <small>Batches manufactured from this material</small>
                    </div>

                    {genealogy.children.length > 0 ? (
                      <div className="genealogy-cards-row">
                        {genealogy.children.map((c) => (
                          <div
                            key={c.entityId}
                            className="genealogy-node-card clickable child"
                            onClick={() => onNavigateEntity(c.entityId)}
                          >
                            <div className="node-card-top">
                              <span className={`type-badge-pill ${c.type}`}>
                                {getTypeIcon(c.type)}
                                {c.type === 'yarn' ? 'Yarn Batch' : 'Rope Batch'}
                              </span>
                              <ExternalLink size={14} className="node-link-icon" />
                            </div>
                            <strong className="node-batch-id">{c.batchId}</strong>
                            {c.treatment && <div className="node-meta">{c.treatment}</div>}
                            {c.quantityUsed && (
                              <div className="node-portion-tag">
                                Used: {c.quantityUsed} {c.unit || 'kg'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="genealogy-empty-notice">
                        No downstream batches derived from this entity yet.
                      </div>
                    )}

                    {/* Grandchildren (e.g. downstream ropes if flat yarn) */}
                    {genealogy.grandchildren && genealogy.grandchildren.length > 0 && (
                      <div className="grandchildren-row">
                        <span className="grandchildren-label">Downstream Rope Batches:</span>
                        <div className="grandchildren-tags">
                          {genealogy.grandchildren.map((gc) => (
                            <button
                              key={gc.entityId}
                              className="grandchild-pill-btn"
                              onClick={() => onNavigateEntity(gc.entityId)}
                            >
                              <Anchor size={12} />
                              <span>{gc.batchId}</span>
                              <small>(via {gc.viaYarnBatch})</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Grandparents (e.g. original flat yarn if rope) */}
                    {genealogy.grandparents && genealogy.grandparents.length > 0 && (
                      <div className="grandchildren-row">
                        <span className="grandchildren-label">Original Flat Yarn Sources:</span>
                        <div className="grandchildren-tags">
                          {genealogy.grandparents.map((gp) => (
                            <button
                              key={gp.entityId}
                              className="grandchild-pill-btn"
                              onClick={() => onNavigateEntity(gp.entityId)}
                            >
                              <Layers size={12} />
                              <span>{gp.batchId}</span>
                              {gp.supplier && <small>({gp.supplier})</small>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PROCESSES / LIFECYCLE */}
      {activeTab === 'processes' && (
        <div className="tab-pane-content">
          <div className="panel-card">
            <div className="panel-head">
              <div>
                <h3>Manufacturing Processes & Lifecycle</h3>
                <p className="panel-head-sub">
                  Chronological record of manufacturing treatments, heat-setting, twisting, braiding, and finishing operations.
                </p>
              </div>
              <button className="primary-button" onClick={onOpenAddProcessModal}>
                <Plus size={15} /> + Add Process
              </button>
            </div>

            <div className="panel-body">
              {entity.processes.length === 0 ? (
                <div className="empty-section-state">
                  <Clock size={28} className="empty-icon" />
                  <h4>No process records logged yet</h4>
                  <p>Capture real manufacturing operations as they occur.</p>
                  <button className="secondary-button" onClick={onOpenAddProcessModal}>
                    <Plus size={14} /> Add First Process
                  </button>
                </div>
              ) : (
                <div className="lifecycle-timeline">
                  {entity.processes.map((proc, index) => (
                    <div key={proc.id} className="lifecycle-item">
                      <div className="lifecycle-marker">
                        <span className="step-counter">{index + 1}</span>
                      </div>
                      <div className="lifecycle-content">
                        <div className="lifecycle-header">
                          <div>
                            <strong className="process-name">{proc.process_name}</strong>
                            <span className="process-date">
                              {formatDateTime(proc.performed_at || proc.created_at)}
                            </span>
                          </div>
                          <span className="process-performer">
                            <User size={13} /> {proc.performed_by_name || 'Operator'}
                          </span>
                        </div>

                        {proc.specification && (
                          <div className="process-spec-box">
                            <span className="spec-label">Specification / Parameters:</span>
                            <strong className="spec-value">{proc.specification}</strong>
                          </div>
                        )}

                        {proc.remarks && (
                          <p className="process-remarks">
                            {proc.remarks}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PARAMETERS & TESTS */}
      {activeTab === 'qc' && (
        <div className="tab-pane-content">
          <div className="qc-columns-grid">
            {/* Parameters Card */}
            <div className="panel-card">
              <div className="panel-head">
                <div>
                  <h3>Parameters & Specifications</h3>
                  <p className="panel-head-sub">Flexible values (e.g. BS, Elongation, Denier, TPM, S, BWS)</p>
                </div>
                <button className="secondary-button" onClick={onOpenAddParamModal}>
                  <Plus size={14} /> + Parameter
                </button>
              </div>

              <div className="panel-body">
                {entity.parameters.length === 0 ? (
                  <div className="empty-section-state mini">
                    <p>No parameters recorded yet.</p>
                    <button className="link-button" onClick={onOpenAddParamModal}>
                      + Add parameter
                    </button>
                  </div>
                ) : (
                  <div className="parameters-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Parameter</th>
                          <th>Value</th>
                          <th>Unit</th>
                          <th>Remarks</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {entity.parameters.map((p) => (
                          <tr key={p.id}>
                            <td className="param-name-cell">
                              <strong>{p.name}</strong>
                            </td>
                            <td className="param-val-cell">
                              <span className="param-val-pill">{p.value}</span>
                            </td>
                            <td>{p.unit || '—'}</td>
                            <td className="param-notes-cell">{p.remarks || '—'}</td>
                            <td className="action-cell">
                              <button
                                className="icon-button danger"
                                title="Remove parameter"
                                onClick={() => onDeleteParam(p.id, p.name)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Tests & QC Observations Card */}
            <div className="panel-card">
              <div className="panel-head">
                <div>
                  <h3>Tests & Observations</h3>
                  <p className="panel-head-sub">QC breakdown tests, sample inspections, and physical testing</p>
                </div>
                <button className="secondary-button" onClick={onOpenAddTestModal}>
                  <Plus size={14} /> + Record Test
                </button>
              </div>

              <div className="panel-body">
                {entity.tests.length === 0 ? (
                  <div className="empty-section-state mini">
                    <p>No tests recorded yet.</p>
                    <button className="link-button" onClick={onOpenAddTestModal}>
                      + Record test
                    </button>
                  </div>
                ) : (
                  <div className="tests-list">
                    {entity.tests.map((t) => (
                      <div key={t.id} className="test-record-card">
                        <div className="test-card-top">
                          <div className="test-name-wrap">
                            <strong>{t.test_name}</strong>
                            <span className={`test-result-badge ${t.result?.toLowerCase()}`}>
                              {t.result || 'Pass'}
                            </span>
                          </div>
                          <button
                            className="icon-button danger"
                            title="Delete test record"
                            onClick={() => onDeleteTest(t.id, t.test_name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="test-value-row">
                          <span className="test-value-large">{t.value} {t.unit}</span>
                          <span className="test-performed-by">
                            {formatDate(t.tested_at || t.created_at)} by {t.performed_by_name || 'QC Analyst'}
                          </span>
                        </div>
                        {t.remarks && <p className="test-remarks">{t.remarks}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: EVIDENCE & ATTACHMENTS */}
      {activeTab === 'evidence' && (
        <div className="tab-pane-content">
          <div className="panel-card">
            <div className="panel-head">
              <div>
                <h3>Evidence & Documents</h3>
                <p className="panel-head-sub">
                  Attach Certificates of Analysis, physical inspection photos, spectrometer curves, or PDF reports.
                </p>
              </div>
              <button className="primary-button" onClick={onOpenUploadEvidenceModal}>
                <Plus size={15} /> + Upload Evidence
              </button>
            </div>

            <div className="panel-body">
              {entity.evidence.length === 0 ? (
                <div className="empty-section-state">
                  <Paperclip size={28} className="empty-icon" />
                  <h4>No evidence documents attached</h4>
                  <p>Upload files or photos to document this batch's quality.</p>
                  <button className="secondary-button" onClick={onOpenUploadEvidenceModal}>
                    <Plus size={14} /> Upload First File
                  </button>
                </div>
              ) : (
                <div className="evidence-grid">
                  {entity.evidence.map((ev) => (
                    <div key={ev.id} className="evidence-card">
                      <div className="evidence-card-icon">
                        {ev.mime_type?.includes('image') ? '🖼️' : '📄'}
                      </div>
                      <div className="evidence-card-info">
                        <strong className="evidence-filename" title={ev.file_name}>
                          {ev.file_name}
                        </strong>
                        <div className="evidence-meta">
                          <span>{(ev.file_size / 1024).toFixed(0)} KB</span>
                          <span>·</span>
                          <span>{formatDate(ev.created_at)}</span>
                        </div>
                        <small className="evidence-uploader">
                          Uploaded by {ev.uploaded_by_name || 'Operator'}
                        </small>
                      </div>
                      <a
                        href={ev.storage_path}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-button evidence-download-btn"
                        download={ev.file_name}
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="tab-pane-content">
          <div className="panel-card">
            <div className="panel-head">
              <div>
                <h3>Chronological Audit History</h3>
                <p className="panel-head-sub">
                  Immutable record of who, when, and what changed across this entity's lifecycle.
                </p>
              </div>
            </div>

            <div className="panel-body">
              {entity.auditLogs.length === 0 ? (
                <div className="empty-section-state mini">
                  <p>No audit events recorded yet.</p>
                </div>
              ) : (
                <div className="audit-timeline">
                  {entity.auditLogs.map((log) => (
                    <div key={log.id} className="audit-item">
                      <div className="audit-marker"></div>
                      <div className="audit-content">
                        <div className="audit-header">
                          <strong className="audit-action">{log.action}</strong>
                          <span className="audit-time">{formatDateTime(log.created_at)}</span>
                        </div>

                        {log.new_value && (
                          <div className="audit-diff-box">
                            {log.old_value && (
                              <div className="diff-old">
                                <span>Previous:</span> <code>{log.old_value}</code>
                              </div>
                            )}
                            <div className="diff-new">
                              <span>{log.old_value ? 'Updated to:' : 'Value:'}</span> <code>{log.new_value}</code>
                            </div>
                          </div>
                        )}

                        <span className="audit-performer">
                          Recorded by <strong>{log.performed_by_name || 'Operator'}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
