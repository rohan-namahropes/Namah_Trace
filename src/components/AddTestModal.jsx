import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

const TEST_PRESETS = [
  'Tensile Breakdown Test',
  'Twist Uniformity Test',
  'Static Breaking Load',
  'Dynamic Drop Test (UIAA)',
  'Boiling Water Shrinkage Test',
  'Elongation Test',
  'Sheath Slippage Test',
  'Visual Defect Inspection',
]

export function AddTestModal({ onClose, onSave }) {
  const [testName, setTestName] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [result, setResult] = useState('Pass')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!testName.trim()) {
      setError('Test name is required.')
      return
    }
    if (!value.trim()) {
      setError('Measurement / value is required.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const savedTest = await onSave({
        testName: testName.trim(),
        value: value.trim(),
        unit: unit.trim(),
        result,
        remarks: remarks.trim(),
      })
      if (savedTest?.error) throw savedTest.error
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save test record')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <div>
            <h2>Record Quality Test / Observation</h2>
            <p className="modal-subtitle">
              Log QC inspection or laboratory breaking results for this batch.
            </p>
          </div>
          <button className="icon-button modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Quick Test Presets */}
        <div className="preset-chips-section">
          <small className="preset-label">TEST TEMPLATES:</small>
          <div className="preset-chips-list">
            {TEST_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                className={`preset-chip-btn ${testName === t ? 'active' : ''}`}
                onClick={() => setTestName(t)}
              >
                {t}
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
            <span>Test Name *</span>
            <input
              type="text"
              required
              placeholder="e.g. Tensile Breakdown Test"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
          </label>

          <div className="form-grid-3">
            <label className="form-field">
              <span>Value / Measurement *</span>
              <input
                type="text"
                required
                placeholder="e.g. 33.2"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Unit</span>
              <input
                type="text"
                placeholder="e.g. kN, %, mm"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Outcome / Result</span>
              <select value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
                <option value="In Spec">In Spec</option>
                <option value="Flagged">Flagged</option>
              </select>
            </label>
          </div>

          <label className="form-field">
            <span>Remarks / Sample Location</span>
            <textarea
              rows={2}
              placeholder="Details on sample specimen, machine settings, or deviation notes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving...' : 'Record Test Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
