import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { EvidenceFileInput, getEvidenceFileError } from './EvidenceFileInput'

const TEST_PRESETS = {
  flat_yarn: ['Breaking Strength', 'Elongation', 'Denier', 'BWS', 'HAS', 'Incoming Inspection'],
  yarn: ['Breaking Strength', 'Elongation', 'Denier', 'TPM', 'Twist Uniformity', 'BWS', 'HAS'],
  rope: [
    'Breaking Strength',
    'Elongation',
    'Impact Force',
    'Fall Factor / Dynamic Performance',
    'Sheath Slippage',
    'Abrasion Resistance',
    'Visual Defect Inspection',
  ],
}

export function AddTestModal({ entityType, onClose, onSave, processes = [] }) {
  const [testName, setTestName] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [applicableStandard, setApplicableStandard] = useState('')
  const [result, setResult] = useState('Pass')
  const [remarks, setRemarks] = useState('')
  const [processId, setProcessId] = useState('')
  const [evidenceFile, setEvidenceFile] = useState(null)
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
      if (evidenceFile) {
        const fileError = getEvidenceFileError(evidenceFile)
        if (fileError) throw new Error(fileError)
      }
      const savedTest = await onSave({
        testName: testName.trim(),
        value: value.trim(),
        unit: unit.trim(),
        productCategory: productCategory.trim(),
        applicableStandard: applicableStandard.trim(),
        result,
        remarks: remarks.trim(),
        processId: processId || null,
        evidenceFile,
      })
      if (savedTest?.error) throw savedTest.error
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save test record')
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
            {(TEST_PRESETS[entityType] || []).map((t) => (
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

          <div className="form-grid-2">
            <label className="form-field">
              <span>Applicable standard (Optional)</span>
              <input
                type="text"
                placeholder="e.g. standard name / edition / clause"
                value={applicableStandard}
                onChange={(e) => setApplicableStandard(e.target.value)}
              />
              <small className="field-hint">Record the standard that applies to this product and test; applicability is not assumed.</small>
            </label>
            {entityType === 'rope' && (
              <label className="form-field">
                <span>Rope category (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. single, half, twin, low-stretch, or factory category"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                />
                <small className="field-hint">
                  Confirm applicability for the product category.{' '}
                  <a href="https://www.theuiaa.org/safety/safety-standards/" target="_blank" rel="noreferrer">
                    Official UIAA safety standards
                  </a>
                </small>
              </label>
            )}
          </div>

          {processes.length > 0 && (
            <label className="form-field">
              <span>Associated Process (Optional)</span>
              <select value={processId} onChange={(e) => setProcessId(e.target.value)}>
                <option value="">-- Standalone test / no process linked --</option>
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.process_name} {process.specification ? `· ${process.specification}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-field">
            <span>Remarks / Sample Location</span>
            <textarea
              rows={2}
              placeholder="Details on sample specimen, machine settings, or deviation notes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>

          <EvidenceFileInput file={evidenceFile} onChange={setEvidenceFile} id="test-evidence-file" />

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
