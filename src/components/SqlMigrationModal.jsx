import React, { useState } from 'react'
import { X, Copy, Check, Database } from 'lucide-react'
import QUANTITY_TRACKING_SQL from '../../supabase/quantity_tracking_production.sql?raw'
import CRITICAL_STOCK_SQL from '../../supabase/critical_stock_and_test_process_migration.sql?raw'
import RECORD_EVIDENCE_SQL from '../../supabase/record_level_evidence_migration.sql?raw'
import YARN_OUTPUT_SQL from '../../supabase/yarn_configuration_and_output_migration.sql?raw'
import YARN_ESTIMATED_ALLOCATION_SQL from '../../supabase/yarn_estimated_output_allocation_migration.sql?raw'
import YARN_REPEAT_LOT_SEQUENCE_SQL from '../../supabase/yarn_repeat_lot_sequence_migration.sql?raw'
import PRODUCTION_IDENTITY_ACCESS_SQL from '../../supabase/production_identity_access_migration.sql?raw'
import EVIDENCE_VIDEO_SQL from '../../supabase/evidence_video_support_migration.sql?raw'
import STOCK_ALERTS_AND_INTAKE_SQL from '../../supabase/stock_alerts_and_flat_yarn_intake_migration.sql?raw'
import FACTORFLOW_DEVELOPMENT_SQL from '../../supabase/factorflow_development_migration.sql?raw'
import FLAT_YARN_SAMPLE_WORKFLOW_SQL from '../../supabase/flat_yarn_sample_workflow_migration.sql?raw'
import COLORING_ESTIMATED_YARN_STOCK_FIX_SQL from '../../supabase/coloring_estimated_yarn_stock_fix.sql?raw'
import ADMIN_BATCH_DELETION_SQL from '../../supabase/admin_batch_deletion_migration.sql?raw'
import SEARCH_PERFORMANCE_SQL from '../../supabase/search_performance_migration.sql?raw'
import GENEALOGY_PERFORMANCE_SQL from '../../supabase/genealogy_performance_migration.sql?raw'

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
    label: '1 of 4 · Thresholds and optional test-process links',
    sql: CRITICAL_STOCK_SQL,
    description: 'Adds Flat Yarn thresholds, test categories/standards, and optional same-batch process links.',
  },
  {
    id: 'record-evidence',
    title: 'Record-level evidence',
    label: '2 of 4 · Evidence linked to a process, parameter, or test',
    sql: RECORD_EVIDENCE_SQL,
    description: 'Adds direct evidence links and configures the evidence Storage bucket as private.',
  },
  {
    id: 'yarn-output',
    title: 'Yarn configuration & output',
    label: '3 of 4 · Named configurations, wastage, and estimates',
    sql: YARN_OUTPUT_SQL,
    description: 'Adds reusable Yarn configurations and transactional estimated-output/wastage fields.',
  },
  {
    id: 'yarn-estimated-allocation',
    title: 'Yarn estimate-based Rope allocation',
    label: '4 of 4 · Allow Rope allocation from estimated Yarn output',
    sql: YARN_ESTIMATED_ALLOCATION_SQL,
    description: 'Updates the protected allocation function to validate Rope input against estimated Yarn output when no actual output is recorded. Apply after Yarn configuration & output.',
  },
  {
    id: 'evidence-video',
    title: 'Video evidence support',
    label: 'Additional · MP4, MOV, and WebM evidence',
    sql: EVIDENCE_VIDEO_SQL,
    description: 'Allows common video formats in the private evidence bucket; retains the existing 25 MB limit.',
  },
  {
    id: 'stock-alerts-intake',
    title: 'Persistent alert dismissals & Flat Yarn intake',
    label: 'Additional · Per-user alert dismissals and renameable intake IDs',
    sql: STOCK_ALERTS_AND_INTAKE_SQL,
    description: 'Stores dismissed stock alerts per user, permits admin-only Flat Yarn ID renaming, and prevents unnamed intake material from being allocated to Yarn.',
  },
  {
    id: 'factorflow-development',
    title: 'Factorflow development updates',
    label: 'Additive · Event dates, yarn identity, sample tests, Rope composition, process specifications, and admin batch IDs',
    sql: FACTORFLOW_DEVELOPMENT_SQL,
    description: 'Adds event timestamps, yarn denier/twist/category, sample IDs, Rope calculation and composition fields, an admin-managed process specification catalog with private uploads, and admin-only batch ID renames. Apply once after the base schema, authorization policies, and quantity-tracking migration.',
  },
  {
    id: 'flat-yarn-sample-workflow',
    title: 'Flat Yarn cone sampling workflow',
    label: 'Additive · Cone registry and per-cone readings',
    sql: FLAT_YARN_SAMPLE_WORKFLOW_SQL,
    description: 'Creates the Flat Yarn cone/sample registry, adds sample IDs for both test and parameter measurements, and migrates existing sample labels into the registry. Apply after the base schema, authorization policies, and Factorflow development updates; safe to rerun.',
  },
  {
    id: 'production-identity-access',
    title: 'Production IDs, color lots & editable access',
    label: 'Core · Rope IDs, colored lots, and editable role permissions',
    sql: PRODUCTION_IDENTITY_ACCESS_SQL,
    description: 'Adds Rope family/diameter and color fields, same-type coloring allocations, and an Admin-editable Admin/Production/QC/Read-only access matrix. Apply after quantity tracking, authorization, Factorflow development, Yarn output, Flat Yarn sample workflow, and stock-alert migrations.',
  },
  {
    id: 'yarn-repeat-lot-sequence',
    title: 'Repeated Yarn production lots',
    label: 'Additional · Unique run IDs for repeated Yarn specifications',
    sql: YARN_REPEAT_LOT_SEQUENCE_SQL,
    description: 'Assigns an atomic sequential suffix to each Yarn production run (for example -01, -02), counting existing unsuffixed runs with the same source and specification. Apply after the Production IDs, color lots & editable access migration.',
  },
  {
    id: 'coloring-estimated-yarn-stock-fix',
    title: 'Coloring estimated Yarn stock fix',
    label: 'Fix · Color Yarn lots with estimated output',
    sql: COLORING_ESTIMATED_YARN_STOCK_FIX_SQL,
    description: 'Updates the coloring RPC to use estimated Yarn output when actual output is not recorded. Apply after Production IDs, color lots & editable access.',
  },
  {
    id: 'admin-batch-deletion',
    title: 'Admin batch deletion',
    label: 'Admin · Delete dummy or incorrect lots safely',
    sql: ADMIN_BATCH_DELETION_SQL,
    description: 'Adds Admin-only batch deletion, removes evidence files and dependent records, and prevents deleting a lot that still has downstream child lots. Apply after Production IDs, color lots & editable access.',
  },
  {
    id: 'search-performance',
    title: 'Global search performance',
    label: 'Performance · Faster partial-match search',
    sql: SEARCH_PERFORMANCE_SQL,
    description: 'Enables PostgreSQL trigram indexes for batch, supplier, treatment, notes, and parameter searches. Apply once to speed up substring matching in global search.',
  },
  {
    id: 'genealogy-performance',
    title: 'Genealogy performance',
    label: 'Performance · Load connected genealogy in one query',
    sql: GENEALOGY_PERFORMANCE_SQL,
    description: 'Adds an RLS-respecting recursive genealogy query so opening the expanded genealogy does not make one round trip per generation.',
  },
]

export function SqlMigrationModal({ onClose }) {
  const [selectedId, setSelectedId] = useState('production-identity-access')
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
                Apply feature migrations after the base schema and authorization policies. Apply each
                migration only once; the selected stock-alert and intake migration is safe to rerun.
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
