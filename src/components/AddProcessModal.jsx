import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { EvidenceFileInput, getEvidenceFileError } from './EvidenceFileInput'

const PROCESS_PRESETS = {
  yarn: [
    { name: 'Twisting', spec: '72' },
    { name: 'Twisting', spec: '80' },
    { name: 'Twisting', spec: '90' },
    { name: 'Twisting', spec: '100' },
    { name: 'Heat Setting', spec: '' },
    { name: 'Knitting', spec: 'Core bundle strand knitting' },
    { name: 'Dyeing', spec: 'Continuous dip liquor application' },
  ],
  rope: [
    { name: 'Braiding', spec: '16-carrier braider' },
    { name: 'Heat Setting', spec: '' },
    { name: 'Quality Control', spec: '' },
    { name: 'Other Treatment', spec: '' },
    { name: 'Packing', spec: '' },
  ],
  flat_yarn: [
    { name: 'Incoming Inspection', spec: '' },
    { name: 'Other', spec: '' },
  ],
}

export function AddProcessModal({ entityType, onClose, onSave }) {
  const [processName, setProcessName] = useState('')
  const [specification, setSpecification] = useState('')
  const [heatSettingPerformed, setHeatSettingPerformed] = useState('yes')
  const [temperature, setTemperature] = useState('')
  const [remarks, setRemarks] = useState('')
  const [evidenceFile, setEvidenceFile] = useState(null)
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
      if (evidenceFile) {
        const fileError = getEvidenceFileError(evidenceFile)
        if (fileError) throw new Error(fileError)
      }
      const processSpecification = processName.trim().toLowerCase() === 'heat setting'
        ? [
          heatSettingPerformed === 'yes' ? 'Performed' : 'Not performed',
          heatSettingPerformed === 'yes' && temperature.trim()
            ? `${temperature.trim()} °C`
            : '',
          specification.trim(),
        ].filter(Boolean).join(' · ')
        : specification.trim()
      const result = await onSave({
        processName: processName.trim(),
        specification: processSpecification,
        remarks: remarks.trim(),
        evidenceFile,
      })
      if (result?.error) throw result.error
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save process record')
      if (err.recordSaved) {
        onClose()
        return
      }
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
            {(PROCESS_PRESETS[entityType] || []).map((p) => (
              <button
                key={`${p.name}-${p.spec}`}
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

          {processName.trim().toLowerCase() === 'heat setting' && (
            <div className="form-grid-2">
              <label className="form-field">
                <span>Heat setting performed?</span>
                <select value={heatSettingPerformed} onChange={(e) => setHeatSettingPerformed(e.target.value)}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
              {heatSettingPerformed === 'yes' && (
                <label className="form-field">
                  <span>Temperature (°C, optional)</span>
                  <input
                    type="number"
                    step="any"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          <label className="form-field">
            <span>Process Remarks / Machine Notes</span>
            <textarea
              rows={3}
              placeholder="Notes on machine number, lot observations, operator hand-off, or visual checks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>

          <EvidenceFileInput file={evidenceFile} onChange={setEvidenceFile} id="process-evidence-file" />

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
