import React, { useMemo, useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { EvidenceFileInput, getEvidenceFileError } from './EvidenceFileInput'

function getCurrentLocalDateTime() {
  const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

export function AddProcessModal({
  entityType,
  processSpecifications = [],
  processSpecificationsError = '',
  onOpenSpecification,
  onClose,
  onSave,
}) {
  const families = useMemo(
    () => [...new Set(processSpecifications.map((item) => item.process_family))].sort(),
    [processSpecifications]
  )
  const [processFamily, setProcessFamily] = useState('')
  const [processSpecificationId, setProcessSpecificationId] = useState('')
  const [specification, setSpecification] = useState('')
  const [heatSettingPerformed, setHeatSettingPerformed] = useState('yes')
  const [temperature, setTemperature] = useState('')
  const [performedAt, setPerformedAt] = useState(getCurrentLocalDateTime)
  const [remarks, setRemarks] = useState('')
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedType = processSpecifications.find((item) => item.id === processSpecificationId)
  const processTypes = processSpecifications.filter((item) => item.process_family === processFamily)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedType) {
      setError('Select a configured process family and type.')
      return
    }

    setBusy(true)
    setError('')
    try {
      if (evidenceFile) {
        const fileError = getEvidenceFileError(evidenceFile)
        if (fileError) throw new Error(fileError)
      }
      const processSpecification = processFamily.trim().toLowerCase() === 'heat setting'
        ? [
          heatSettingPerformed === 'yes' ? 'Performed' : 'Not performed',
          heatSettingPerformed === 'yes' && temperature.trim()
            ? `${temperature.trim()} °C`
            : '',
          specification.trim(),
        ].filter(Boolean).join(' · ')
        : specification.trim()
      const result = await onSave({
        processFamily,
        processType: selectedType.type_name,
        processSpecificationId: selectedType.id,
        specification: processSpecification,
        remarks: remarks.trim(),
        performedAt,
        evidenceFile,
      })
      if (result?.error) throw result.error
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save process record')
      if (err.recordSaved || err.operationCommitted) {
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

        {error && (
          <div className="modal-error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {processSpecificationsError && (
          <div className="modal-error-alert" role="alert">{processSpecificationsError}</div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid-2">
            <label className="form-field">
              <span>Process family *</span>
              <select
                required
                value={processFamily}
                onChange={(e) => {
                  setProcessFamily(e.target.value)
                  setProcessSpecificationId('')
                }}
              >
                <option value="">Select process family</option>
                {families.map((family) => <option key={family} value={family}>{family}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Process type *</span>
              <select
                required
                value={processSpecificationId}
                onChange={(e) => setProcessSpecificationId(e.target.value)}
                disabled={!processFamily}
              >
                <option value="">Select process type</option>
                {processTypes.map((item) => (
                  <option key={item.id} value={item.id}>{item.type_name}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedType && (
            <div className="form-field">
              <span>Type specification</span>
              {selectedType.specification_file_name
                ? <button
                  type="button"
                  className="text-action"
                  onClick={() => onOpenSpecification?.(selectedType.id)}
                >
                  View {selectedType.specification_file_name}
                </button>
                : <small className="field-hint">No specification file has been uploaded for this type yet.</small>}
            </div>
          )}

          <label className="form-field">
            <span>Actual operational parameters</span>
            <input
              type="text"
              placeholder="e.g. 180°C / 30 min, spindle speed, tension..."
              value={specification}
              onChange={(e) => setSpecification(e.target.value)}
            />
            <small className="field-hint">Key machine settings, temperatures, duration, or speeds</small>
          </label>

          {processFamily.trim().toLowerCase() === 'heat setting' && (
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
            <span>When process happened</span>
            <input
              type="datetime-local"
              required
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
            />
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
