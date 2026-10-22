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

function getParentDisplayDetails(parent) {
  const measurements = [...(parent.parameters || []), ...(parent.tests || [])]
  const findMeasurement = (matcher) => measurements.find((item) => matcher(item.name || ''))
  const denierMeasurement = findMeasurement((name) => /denier/i.test(name))
  const twistMeasurement = findMeasurement((name) => (
    /\b(twist type|twist direction|direction of twist)\b/i.test(name)
    || /^twist$/i.test(name.trim())
  ))
  const denier = denierMeasurement
    ? `${denierMeasurement.value}${denierMeasurement.unit ? ` ${denierMeasurement.unit}` : ''}`
    : parent.type === 'yarn'
      ? parent.treatment?.match(/\b\d+(?:\.\d+)?\s*denier\b/i)?.[0] || ''
      : ''
  const twistType = twistMeasurement
    ? `${twistMeasurement.name}: ${twistMeasurement.value}${twistMeasurement.unit ? ` ${twistMeasurement.unit}` : ''}`
    : ''

  if (parent.type === 'flat_yarn') {
    return [
      parent.supplier ? `Supplier: ${parent.supplier}` : '',
      denier ? `Denier: ${denier}` : '',
    ].filter(Boolean)
  }

  if (parent.type === 'yarn') {
    return [
      denier ? `Denier: ${denier}` : '',
      twistType || (parent.treatment ? `Treatment: ${parent.treatment}` : ''),
    ].filter(Boolean)
  }

  return []
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
      recordedAt: item.created_at,
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
      recordedAt: item.created_at,
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
      recordedAt: item.created_at,
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
      recordedAt: item.created_at,
      detail: item.test_name
        ? `Evidence for test: ${item.test_name}`
        : item.parameter_name
          ? `Evidence for parameter: ${item.parameter_name}`
          : item.process_name
            ? `Evidence for process: ${item.process_name}`
            : 'Batch-level document',
      remarks: [
        item.mime_type || 'File type unknown',
        item.file_size == null ? 'File size unknown' : `${item.file_size} bytes`,
      ].join(' · '),
      actor: item.uploaded_by_name,
    })),
    ...(entity.notes ? [{
      id: `remarks-${entity.id}`,
      type: 'Remarks',
      className: 'remarks',
      icon: <FileText size={15} />,
      title: 'Batch remarks',
      timestamp: entity.created_at,
      recordedAt: entity.created_at,
      remarks: entity.notes,
    }] : []),
  ].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0))

  const handleDownloadReport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const genealogyEdges = genealogy.treeEdges || []
    const isRope = entity.type === 'rope'
    const nodesById = new Map()
    const outgoing = new Map()
    const incomingCounts = new Map()
    for (const edge of genealogyEdges) {
      nodesById.set(edge.parentId, {
        id: edge.parentId,
        batchId: edge.parentBatchId,
        type: edge.parentType,
        detail: edge.parentTreatment,
      })
      nodesById.set(edge.childId, {
        id: edge.childId,
        batchId: edge.childBatchId,
        type: edge.childType,
        detail: edge.childTreatment,
      })
      incomingCounts.set(edge.parentId, incomingCounts.get(edge.parentId) || 0)
      incomingCounts.set(edge.childId, (incomingCounts.get(edge.childId) || 0) + 1)
      outgoing.set(edge.parentId, [...(outgoing.get(edge.parentId) || []), edge.childId])
    }
    const parentDetailsById = new Map(
      (entity.parentRecords || []).map((parent) => [parent.entityId, getParentDisplayDetails(parent)])
    )
    for (const [parentId, details] of parentDetailsById) {
      const node = nodesById.get(parentId)
      if (node) node.details = details
    }
    const depthById = new Map()
    const ready = [...nodesById.values()]
      .filter((node) => incomingCounts.get(node.id) === 0)
      .sort((left, right) => left.batchId.localeCompare(right.batchId))
    ready.forEach((node) => depthById.set(node.id, 0))
    while (ready.length) {
      const node = ready.shift()
      for (const childId of outgoing.get(node.id) || []) {
        depthById.set(childId, Math.max(depthById.get(childId) || 0, depthById.get(node.id) + 1))
        const incoming = incomingCounts.get(childId) - 1
        incomingCounts.set(childId, incoming)
        if (incoming === 0) {
          ready.push(nodesById.get(childId))
          ready.sort((left, right) => left.batchId.localeCompare(right.batchId))
        }
      }
    }
    const genealogyDiagram = genealogyEdges.length && depthById.size === nodesById.size
      ? (() => {
        const rowsByDepth = new Map()
        for (const node of nodesById.values()) {
          const depth = depthById.get(node.id)
          rowsByDepth.set(depth, [...(rowsByDepth.get(depth) || []), node])
        }
        for (const row of rowsByDepth.values()) {
          row.sort((left, right) => left.batchId.localeCompare(right.batchId))
        }
        const boxWidth = 154
        const boxHeight = 64
        const columnCount = Math.max(1, ...[...rowsByDepth.values()].map((row) => row.length))
        const columnGap = 18
        const rowGap = 0
        const layerGap = 50
        const horizontalPadding = 8
        const verticalPadding = 8
        const positions = new Map()
        const diagramWidth = horizontalPadding * 2
          + columnCount * boxWidth
          + Math.max(0, columnCount - 1) * columnGap
        let nextLayerY = verticalPadding
        for (const [depth, row] of rowsByDepth) {
          const rowOffset = (columnCount - row.length) * (boxWidth + columnGap) / 2
          row.forEach((node, index) => {
            positions.set(node.id, {
              x: horizontalPadding + rowOffset + index * (boxWidth + columnGap),
              y: nextLayerY,
            })
          })
          nextLayerY += boxHeight + rowGap + layerGap
        }
        const diagramHeight = Math.max(
          ...[...positions.values()].map((position) => position.y + boxHeight)
        ) + verticalPadding
        const connectors = genealogyEdges.map((edge) => {
          const parent = positions.get(edge.parentId)
          const child = positions.get(edge.childId)
          if (!parent || !child) return ''
          const startX = parent.x + boxWidth / 2
          const startY = parent.y + boxHeight
          const endX = child.x + boxWidth / 2
          const endY = child.y
          const middleY = startY + (endY - startY) / 2
          return `<path d="M ${startX} ${startY} C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}" />`
        }).join('')
        const nodeMarkup = [...nodesById.values()].map((node) => {
          const position = positions.get(node.id)
          const details = node.details || (node.type === 'yarn' && node.detail ? [node.detail] : [])
          const batchY = details.length ? position.y + 21 : position.y + 36
          const detailMarkup = details.slice(0, 2).map((detail, index) => (
            `<text class="node-type" x="${position.x + boxWidth / 2}" y="${position.y + 39 + index * 14}" textLength="${boxWidth - 18}" lengthAdjust="spacingAndGlyphs">${escapeHtml(detail)}</text>`
          )).join('')
          return `<g class="${node.id === entity.id ? 'current' : ''}"><rect x="${position.x}" y="${position.y}" width="${boxWidth}" height="${boxHeight}" rx="6" />
            <text class="node-batch" x="${position.x + boxWidth / 2}" y="${batchY}" textLength="${boxWidth - 18}" lengthAdjust="spacingAndGlyphs">${escapeHtml(node.batchId)}</text>
            ${detailMarkup}</g>`
        }).join('')
        return `<div class="genealogy-diagram"><svg role="img" aria-label="Batch genealogy" viewBox="0 0 ${diagramWidth} ${diagramHeight}" xmlns="http://www.w3.org/2000/svg">
          <g class="genealogy-connectors">${connectors}</g><g class="genealogy-nodes">${nodeMarkup}</g>
        </svg></div>`
      })()
      : ''
    const rows = entries.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.type)}</td>
        <td>${escapeHtml(entry.title)}</td>
        <td>${escapeHtml(entry.detail || '—')}</td>
        <td>${escapeHtml(entry.remarks || '—')}</td>
        <td>${escapeHtml(entry.actor || '—')}</td>
        <td>${escapeHtml(formatDateTime(entry.timestamp))}</td>
        <td>${escapeHtml(formatDateTime(entry.recordedAt || entry.timestamp))}</td>
      </tr>
    `).join('')
    const auditRows = auditLogs.map((log) => `
      <tr>
        <td>${escapeHtml(log.action || '—')}</td>
        <td>${escapeHtml(log.field_name || '—')}</td>
        <td>${escapeHtml(log.old_value || '—')}</td>
        <td>${escapeHtml(log.new_value || '—')}</td>
        <td>${escapeHtml(log.performed_by_name || '—')}</td>
        <td>${escapeHtml(formatDateTime(log.created_at))}</td>
      </tr>
    `).join('')
    const parentRecordBlocks = (entity.parentRecords || []).map((parent) => {
      const parentDetails = getParentDisplayDetails(parent)
      const records = [
        ...parent.processes.map((item) => ({
          type: 'Process',
          name: item.process_name,
          details: item.specification,
          remarks: item.remarks,
          eventAt: item.performed_at,
        })),
        ...parent.parameters.map((item) => ({
          type: 'Parameter',
          name: item.name,
          details: `${item.value}${item.unit ? ` ${item.unit}` : ''}`,
          remarks: item.remarks,
          eventAt: item.created_at,
        })),
        ...parent.tests.map((item) => ({
          type: 'Test',
          name: item.test_name,
          details: `${item.value}${item.unit ? ` ${item.unit}` : ''} · ${item.result || 'Pass'}${item.product_category ? ` · Category: ${item.product_category}` : ''}${item.applicable_standard ? ` · Standard: ${item.applicable_standard}` : ''}${item.process_name ? ` · Process: ${item.process_name}` : ''}`,
          remarks: item.remarks,
          eventAt: item.tested_at,
        })),
      ].sort((left, right) => new Date(left.eventAt || 0) - new Date(right.eventAt || 0))
      const parentRows = records.map((record) => `
        <tr>
          <td>${escapeHtml(record.type)}</td>
          <td>${escapeHtml(record.name)}</td>
          <td>${escapeHtml(record.details || '—')}</td>
          <td>${escapeHtml(record.remarks || '—')}</td>
          <td>${escapeHtml(formatDateTime(record.eventAt))}</td>
        </tr>
      `).join('')
      return `<section class="report-section parent-record-block"><h3>${escapeHtml(typeLabels[parent.type] || parent.type)} · ${escapeHtml(parent.batchId)}</h3>
        ${parentDetails.length ? `<p class="parent-identifiers">${parentDetails.map(escapeHtml).join(' · ')}</p>` : ''}
        <table><thead><tr><th>Type</th><th>Record</th><th>Details</th><th>Remarks</th><th>Date</th></tr></thead>
        <tbody>${parentRows || '<tr><td colspan="5">No process, parameter, or test records for this parent.</td></tr>'}</tbody></table>
      </section>`
    }).join('')
    const ownLifecycleSection = `<section class="report-section"><h2>${isRope ? 'Rope batch records' : 'Lifecycle records'}</h2>
      <table><thead><tr><th>Type</th><th>Record</th><th>Details</th><th>Remarks / evidence context</th><th>Recorded by</th><th>Event time</th><th>Record time</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No lifecycle records</td></tr>'}</tbody></table>
    </section>`
    const html = `<!doctype html>
      <html><head><title>Namah Trace · ${escapeHtml(entity.batch_id)}</title>
      <style>
        *{box-sizing:border-box}
        body{font:12px/1.45 Arial,sans-serif;color:#253247;margin:0 auto;padding:32px;max-width:1100px;background:#fff}
        header{border-bottom:2px solid #1d766d;padding-bottom:16px;margin-bottom:22px}
        .brand{font-size:10px;letter-spacing:.13em;font-weight:700;color:#1d766d;text-transform:uppercase}
        h1{font-size:25px;line-height:1.15;margin:8px 0 3px;color:#172b3c;overflow-wrap:anywhere}
        h2{font-size:15px;line-height:1.25;margin:0 0 10px;color:#172b3c}
        h3{font-size:12px;margin:0 0 8px;color:#245b58}
        p{margin:4px 0;color:#586575}
        section{margin-top:22px}
        @page{size:A4 portrait;margin:12mm}
        dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px 14px;margin:0;padding:14px;background:#f5f8f8;border:1px solid #e1e9e8;border-radius:8px}
        dt{font-size:9px;color:#657482;text-transform:uppercase;letter-spacing:.06em}
        dd{margin:2px 0 0;font-size:11px;font-weight:600;overflow-wrap:anywhere}
        table{border-collapse:collapse;width:100%;margin-top:8px;table-layout:fixed;font-size:9px;line-height:1.35}
        th,td{text-align:left;vertical-align:top;padding:6px 5px;border-bottom:1px solid #e1e7eb;overflow-wrap:anywhere;word-break:break-word}
        th{background:#edf3f3;color:#334b5a;font-size:8px;text-transform:uppercase;letter-spacing:.025em}
        tbody tr:nth-child(even){background:#fafcfc}
        .genealogy-diagram{width:100%;margin:6px auto 0;text-align:center}
        .genealogy-diagram svg{display:block;width:100%;height:auto;max-width:150mm;margin:auto}
        .genealogy-connectors path{fill:none;stroke:#8796a2;stroke-width:1.25}
        .genealogy-nodes rect{fill:#fff;stroke:#d6dfe4;stroke-width:1.2}
        .genealogy-nodes g.current rect{fill:#f3f8ff;stroke:#1664c0;stroke-width:1.6}
        .genealogy-nodes text{text-anchor:middle;fill:#253b4a}
        .genealogy-nodes .node-batch{font-size:11px;font-weight:700}
        .genealogy-nodes .node-type{font-size:9px;fill:#687985}
        .parent-record-block{break-inside:avoid}
        .parent-record-block+ .parent-record-block{margin-top:14px}
        @media print{
          body{max-width:none;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .report-section{break-inside:auto}
          h2,h3{break-after:avoid}
          thead{display:table-header-group}
          tr{break-inside:avoid}
          .genealogy-diagram{break-inside:avoid}
          .genealogy-diagram svg{width:100%;max-width:150mm}
        }
      </style></head><body>
      <header><div class="brand">Namah Trace · Batch report</div><h1>${escapeHtml(entity.batch_id)}</h1>
      <p>${escapeHtml(typeLabels[entity.type] || entity.type)} · Generated ${escapeHtml(formatDateTime(new Date().toISOString()))}</p></header>
      <dl>
        <div><dt>Batch ID</dt><dd>${escapeHtml(entity.batch_id)}</dd></div>
        <div><dt>Type</dt><dd>${escapeHtml(typeLabels[entity.type] || entity.type)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(entity.status || 'In Progress')}</dd></div>
        <div><dt>Created</dt><dd>${escapeHtml(formatDateTime(entity.created_at))}</dd></div>
        <div><dt>Recorded by</dt><dd>${escapeHtml(entity.created_by_name || '—')}</dd></div>
        <div><dt>Recorded output</dt><dd>${escapeHtml(entity.quantity == null ? 'Unspecified' : `${entity.quantity} ${entity.unit || ''}`)}</dd></div>
        ${!isRope ? `<div><dt>Consumed</dt><dd>${escapeHtml(entity.quantityConsumed == null ? 'Unknown' : `${entity.quantityConsumed} ${entity.unit || ''}`)}</dd></div>` : ''}
        ${!isRope ? `<div><dt>Remaining</dt><dd>${escapeHtml(entity.consumptionKnown ? `${entity.quantityRemaining} ${entity.unit}` : 'Unknown')}</dd></div>` : ''}
        ${entity.estimated_output_quantity != null ? `<div><dt>Estimated output</dt><dd>${escapeHtml(`${entity.estimated_output_quantity} ${entity.unit || ''}`)}</dd></div>` : ''}
        ${entity.wastage_percentage != null ? `<div><dt>Wastage estimate</dt><dd>${escapeHtml(`${entity.wastage_percentage}%`)}</dd></div>` : ''}
        ${entity.supplier ? `<div><dt>Supplier</dt><dd>${escapeHtml(entity.supplier)}</dd></div>` : ''}
        ${entity.treatment ? `<div><dt>Treatment</dt><dd>${escapeHtml(entity.treatment)}</dd></div>` : ''}
        ${entity.critical_quantity_threshold != null ? `<div><dt>Critical stock threshold</dt><dd>${escapeHtml(`${entity.critical_quantity_threshold} ${entity.critical_quantity_threshold_unit || entity.unit || ''}`)}</dd></div>` : ''}
      </dl>
      ${entity.notes ? `<section class="report-section"><h2>Batch notes</h2><p>${escapeHtml(entity.notes)}</p></section>` : ''}
      ${isRope ? ownLifecycleSection : ''}
      <section class="report-section"><h2>Genealogy</h2>
        ${genealogyDiagram || '<p>No material links recorded.</p>'}
      </section>
      ${isRope ? `<section class="report-section"><h2>Parent batch details</h2>
        ${parentRecordBlocks || '<p>No parent batches are linked to this Rope batch.</p>'}
      </section>` : ''}
      ${isRope ? '' : ownLifecycleSection}
      <section class="report-section"><h2>Change history</h2>
        <table><thead><tr><th>Action</th><th>Field</th><th>Previous value</th><th>New value / details</th><th>Recorded by</th><th>Recorded at</th></tr></thead>
        <tbody>${auditRows || '<tr><td colspan="6">No change history recorded.</td></tr>'}</tbody></table>
      </section>
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
