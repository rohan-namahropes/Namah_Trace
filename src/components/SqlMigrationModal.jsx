import React, { useState } from 'react'
import { X, Copy, Check, Database } from 'lucide-react'
import SQL_SCHEMA from '../../supabase/quantity_tracking_production.sql?raw'

export function SqlMigrationModal({ onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCHEMA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog sql-modal">
        <div className="modal-head">
          <div className="modal-title-with-icon">
            <Database size={20} className="panel-icon text-navy" />
            <div>
              <h2>Supabase Quantity Tracking Migration</h2>
              <p className="modal-subtitle">
                Apply this after the existing schema in Supabase SQL Editor. It enables atomic quantity allocation.
              </p>
            </div>
          </div>
          <button className="icon-button modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="sql-box-header">
          <span>PostgreSQL Migration · Quantity validation & RPC</span>
          <button className="primary-button copy-sql-btn" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
          </button>
        </div>

        <pre className="sql-code-block">
          <code>{SQL_SCHEMA}</code>
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
