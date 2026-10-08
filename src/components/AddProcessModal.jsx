import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

const PROCESS_PRESETS = [
  { name: 'Twisting', spec: '1600 TPM S-twist' },
  { name: 'Heat Setting', spec: '180°C / 30 min in steam chamber' },
  { name: 'Knitting', spec: 'Core bundle strand knitting' },
  { name: 'Braiding', spec: '16-carrier Herzog braider' },
  { name: 'Dyeing', spec: 'Continuous dip liquor application' },
  { name: 'Finishing & Cutting', spec: 'Hot-knife end sealing into 200m coils' },
  { name: 'Packaging', spec: 'Shrink-wrapped with batch traceability label' },
]

export function AddProcessModal({ onClose, onSave }) {
  const [processName, setProcessName] = useState('')
  const [specification, setSpecification] = useState('')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSelectPreset = (p) => {
    setProcessName(p.name)
    if (!specification) setSpecification(p.spec)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!processName.trim()) {
      setError('Process name is required.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const result = await onSave({
        processName: processName.trim(),
        specification: specification.trim(),
        remarks: remarks.trim(),
      })
      if (result?.error) throw result.error
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save process record')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <div>
            <h2>Record Manufacturing Process</h2>
            <p className="modal-subtitle">
              Capture what actually happened to this batch during factory operations.
            </p>
          </div>
          <button className="icon-button modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Process Presets */}
        <div className="preset-chips-section">
          <small className="preset-label">PROCESS TEMPLATES:</small>
          <div className="preset-chips-list">
            {PROCESS_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className={`preset-chip-btn ${processName === p.name ? 'active' : ''}`}
                onClick={() => handleSelectPreset(p)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="modal-error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="form-field">
            <span>Process Name *</span>
            <input
              type="text"
              required
              placeholder="e.g. Heat Setting, Twisting, Braiding, Dyeing..."
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Specification / Operational Parameters</span>
            <input
              type="text"
              placeholder="e.g. 180°C / 30 min, Spindle speed 7200 RPM, tension 45N..."
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
            />
            <small className="field-hint">Key machine settings, temperatures, duration, or speeds</small>
          </label>

          <label className="form-field">
            <span>Process Remarks / Machine Notes</span>
            <textarea
              rows={3}
              placeholder="Notes on machine number, lot observations, operator hand-off, or visual checks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving...' : 'Add Process Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
