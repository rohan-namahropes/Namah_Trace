import React, { useState } from 'react'
import { X, Copy, Check, Database } from 'lucide-react'
import QUANTITY_TRACKING_SQL from '../../supabase/quantity_tracking_production.sql?raw'
import CRITICAL_STOCK_SQL from '../../supabase/critical_stock_and_test_process_migration.sql?raw'
import RECORD_EVIDENCE_SQL from '../../supabase/record_level_evidence_migration.sql?raw'
import YARN_OUTPUT_SQL from '../../supabase/yarn_configuration_and_output_migration.sql?raw'
import EVIDENCE_VIDEO_SQL from '../../supabase/evidence_video_support_migration.sql?raw'

const MIGRATIONS = [
  {
    id: 'quantity-tracking',
    title: 'Quantity tracking prerequisite',
    label: 'Prerequisite · Atomic quantity allocation',
    sql: QUANTITY_TRACKING_SQL,
    description: 'Install once if the existing protected quantity-allocation RPC is not already present.',
  },
  {
    id: 'critical-stock',
    title: 'Critical stock & test linkage',
    label: '1 of 3 · Thresholds and optional test-process links',
    sql: CRITICAL_STOCK_SQL,
    description: 'Adds Flat Yarn thresholds, test categories/standards, and optional same-batch process links.',
  },
  {
    id: 'record-evidence',
    title: 'Record-level evidence',
    label: '2 of 3 · Evidence linked to a process, parameter, or test',
    sql: RECORD_EVIDENCE_SQL,
    description: 'Adds direct evidence links and configures the evidence Storage bucket as private.',
  },
  {
    id: 'yarn-output',
    title: 'Yarn configuration & output',
    label: '3 of 3 · Named configurations, wastage, and estimates',
    sql: YARN_OUTPUT_SQL,
    description: 'Adds reusable Yarn configurations and transactional estimated-output/wastage fields.',
  },
  {
    id: 'evidence-video',
    title: 'Video evidence support',
    label: 'Additional · MP4, MOV, and WebM evidence',
    sql: EVIDENCE_VIDEO_SQL,
    description: 'Allows common video formats in the private evidence bucket; retains the existing 25 MB limit.',
  },
]

export function SqlMigrationModal({ onClose }) {
  const [selectedId, setSelectedId] = useState('critical-stock')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const selectedMigration = MIGRATIONS.find((migration) => migration.id === selectedId)

  const handleCopy = async () => {
    setCopyError('')
    try {
      await navigator.clipboard.writeText(selectedMigration.sql)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      setCopied(false)
      setCopyError(error.message || 'Could not copy the migration. Select and copy the SQL manually.')
    }
  }

  const handleSelect = (event) => {
    setSelectedId(event.target.value)
    setCopied(false)
    setCopyError('')
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog sql-modal">
        <div className="modal-head">
          <div className="modal-title-with-icon">
            <Database size={20} className="panel-icon text-navy" />
            <div>
              <h2>Supabase Database Migrations</h2>
              <p className="modal-subtitle">
                Apply the three feature migrations in order after the base schema, authorization policies,
                and quantity-tracking prerequisite are installed. Video support is an additional migration.
              </p>
            </div>
          </div>
          <button className="icon-button modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="form-field migration-select-field">
          <label htmlFor="migration-select">Migration</label>
          <select id="migration-select" value={selectedId} onChange={handleSelect}>
            {MIGRATIONS.map((migration) => (
              <option key={migration.id} value={migration.id}>{migration.title}</option>
            ))}
          </select>
          <small className="field-hint">{selectedMigration.description}</small>
        </div>

        <p className="modal-subtitle migration-safety-note">
          Review and test against a development database first. Do not apply these scripts to production
          without explicit approval. Run the quantity-tracking prerequisite only if it has not already been installed.
        </p>

        <div className="sql-box-header">
          <span>PostgreSQL Migration · {selectedMigration.label}</span>
          <button className="primary-button copy-sql-btn" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
          </button>
        </div>

        {copyError && <div className="modal-error-alert" role="alert">{copyError}</div>}

        <pre className="sql-code-block">
          <code>{selectedMigration.sql}</code>
        </pre>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="primary-button" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy SQL Script'}
          </button>
        </div>
      </div>
    </div>
  )
}
