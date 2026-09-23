import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

const PARAM_PRESETS = [
  { name: 'BS', label: 'Breaking Strength (BS)', unit: 'kN' },
  { name: 'Elongation', label: 'Elongation (%)', unit: '%' },
  { name: 'Denier', label: 'Denier (Linear density)', unit: 'D' },
  { name: 'TPM', label: 'Twists Per Metre (TPM)', unit: 'TPM' },
  { name: 'Twist Direction', label: 'Twist Direction (S/Z)', unit: '' },
  { name: 'BWS', label: 'Boiling Water Shrinkage (BWS)', unit: '%' },
  { name: 'Diameter', label: 'Rope Diameter', unit: 'mm' },
  { name: 'Linear Mass', label: 'Linear Mass / Weight', unit: 'g/m' },
]

export function AddParameterModal({ onClose, onSave }) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSelectPreset = (preset) => {
    setName(preset.name)
    if (preset.unit) setUnit(preset.unit)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Parameter name is required.')
      return
    }
    if (!value.trim()) {
      setError('Parameter value is required.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        value: value.trim(),
        unit: unit.trim(),
        remarks: remarks.trim(),
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save parameter')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <div>
            <h2>Add Parameter / Specification</h2>
            <p className="modal-subtitle">
              Record physical, mechanical, or dimension metrics for this batch.
            </p>
          </div>
          <button className="icon-button modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="preset-chips-section">
          <small className="preset-label">COMMON PRESETS:</small>
          <div className="preset-chips-list">
            {PARAM_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className={`preset-chip-btn ${name === p.name ? 'active' : ''}`}
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
          <div className="form-grid-2">
            <label className="form-field">
              <span>Parameter Name *</span>
              <input
                type="text"
                required
                placeholder="e.g. BS, Elongation, Denier..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Measured Value *</span>
              <input
                type="text"
                required
                placeholder="e.g. 28.4"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
          </div>

          <div className="form-grid-2">
            <label className="form-field">
              <span>Unit of Measure</span>
              <input
                type="text"
                placeholder="e.g. kN, %, D, TPM, mm, g/m"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Remarks / Reference</span>
              <input
                type="text"
                placeholder="e.g. In spec, test standard EN 892"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving...' : 'Save Parameter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
