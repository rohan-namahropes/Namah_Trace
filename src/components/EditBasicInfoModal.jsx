import React, { useState } from 'react'
import { X, AlertCircle, Check } from 'lucide-react'

function toLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000)
  return date.toISOString().slice(0, 16)
}

export function EditBasicInfoModal({ entity, isAdmin = false, canEdit = isAdmin, onClose, onSave }) {
  const [batchId, setBatchId] = useState(entity.batch_id || '')
  const [supplier, setSupplier] = useState(entity.supplier || '')
  const [denier, setDenier] = useState(entity.denier || '')
  const [treatment, setTreatment] = useState(entity.treatment || '')
  const [twistDirection, setTwistDirection] = useState(entity.twist_direction || '')
  const [twistDirectionOther, setTwistDirectionOther] = useState(entity.twist_direction_other || '')
  const [yarnCategory, setYarnCategory] = useState(entity.yarn_category || '')
  const [occurredAt, setOccurredAt] = useState(toLocalDateTime(entity.occurred_at || entity.created_at))
  const [ropeTargetLength, setRopeTargetLength] = useState(
    entity.rope_target_length != null ? String(entity.rope_target_length) : ''
  )
  const [ropeGramsPerMeter, setRopeGramsPerMeter] = useState(
    entity.rope_grams_per_meter != null ? String(entity.rope_grams_per_meter) : ''
  )
  const [quantity, setQuantity] = useState(entity.quantity != null ? String(entity.quantity) : '')
  const [unit, setUnit] = useState(entity.unit || (entity.type === 'rope' ? 'meters' : 'kg'))
  const [estimatedOutput, setEstimatedOutput] = useState(
    entity.estimated_output_quantity != null ? String(entity.estimated_output_quantity) : ''
  )
  const [wastagePercentage, setWastagePercentage] = useState(
    entity.wastage_percentage != null ? String(entity.wastage_percentage) : ''
  )
  const [criticalThreshold, setCriticalThreshold] = useState(
    entity.critical_quantity_threshold != null ? String(entity.critical_quantity_threshold) : ''
  )
  const [criticalThresholdUnit, setCriticalThresholdUnit] = useState(
    entity.critical_quantity_threshold_unit || unit || 'kg'
  )
  const [notes, setNotes] = useState(entity.notes || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (
      entity.type === 'flat_yarn'
      && canEdit
      && criticalThreshold
      && criticalThresholdUnit !== unit
    ) {
      setError('Critical threshold unit must match the batch stock unit. No automatic conversion is applied.')
      return
    }
    if (
      entity.type === 'yarn'
      && wastagePercentage
      && (!Number.isFinite(Number(wastagePercentage))
        || Number(wastagePercentage) < 0
        || Number(wastagePercentage) > 100)
    ) {
      setError('Wastage percentage must be between 0 and 100.')
      return
    }
    if (entity.type === 'rope' && (
      Boolean(ropeTargetLength) !== Boolean(ropeGramsPerMeter)
      || (ropeTargetLength && (!Number.isFinite(Number(ropeTargetLength)) || Number(ropeTargetLength) <= 0))
      || (ropeGramsPerMeter && (!Number.isFinite(Number(ropeGramsPerMeter)) || Number(ropeGramsPerMeter) <= 0))
    )) {
      setError('Target length and grams per meter must both be positive values or both be empty.')
      return
    }
    if (
      entity.type === 'yarn'
      && estimatedOutput
      && (!Number.isFinite(Number(estimatedOutput)) || Number(estimatedOutput) < 0)
    ) {
      setError('Estimated output must be a finite, non-negative quantity.')
      return
    }
    setBusy(true)

    try {
      const updates = {
        notes: notes.trim(),
        quantity: quantity ? Number(quantity) : null,
        unit,
        occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
      }
      if (isAdmin && batchId.trim() !== entity.batch_id) {
        updates.batch_id = batchId.trim()
      }
      if (entity.type === 'yarn') {
        updates.estimated_output_quantity = estimatedOutput ? Number(estimatedOutput) : null
        updates.wastage_percentage = wastagePercentage ? Number(wastagePercentage) : null
      }
      if (entity.type === 'flat_yarn' && canEdit) {
        updates.supplier = supplier.trim()
        updates.denier = denier.trim()
        updates.critical_quantity_threshold = criticalThreshold ? Number(criticalThreshold) : null
        updates.critical_quantity_threshold_unit = criticalThresholdUnit || unit || 'kg'
      } else if (entity.type === 'flat_yarn') {
        updates.supplier = supplier.trim()
      }
      if (entity.type === 'yarn' && canEdit) {
        updates.treatment = treatment.trim()
        updates.denier = denier.trim()
        updates.twist_direction = twistDirection || null
        updates.twist_direction_other = twistDirection === 'Other' ? twistDirectionOther.trim() : null
        updates.yarn_category = yarnCategory.trim()
      } else if (entity.type === 'yarn') {
        updates.treatment = treatment.trim()
      }
      if (entity.type === 'rope' && canEdit) {
        updates.rope_target_length = ropeTargetLength ? Number(ropeTargetLength) : null
        updates.rope_grams_per_meter = ropeGramsPerMeter ? Number(ropeGramsPerMeter) : null
      }

      const result = await onSave(updates)
      if (result?.error) throw result.error
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update basic information')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <div>
            <h2>Edit Batch Information</h2>
            <p className="modal-subtitle">
              Updating fields will automatically write an entry to the immutable audit trail.
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

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid-2">
            {isAdmin ? (
              <label className="form-field">
                <span>Batch ID</span>
                <input
                  type="text"
                  value={batchId}
                  onChange={(event) => setBatchId(event.target.value)}
                  placeholder="Set or rename the batch identifier"
                />
                <small className="field-hint">
                  {entity.type === 'flat_yarn' && entity.batch_id.toUpperCase().startsWith('INTAKE-')
                    ? 'Set a permanent identifier before using this intake to create Yarn.'
                    : 'Admins can rename this identifier.'}
                </small>
              </label>
            ) : (
              <div className="form-field">
                <span>Batch ID</span>
                <input type="text" value={entity.batch_id} disabled className="input-disabled" />
                <small className="field-hint">Primary batch identifier</small>
              </div>
            )}

            {entity.type === 'flat_yarn' && (
              <label className="form-field">
                <span>Supplier</span>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. ABC Corp"
                  disabled={!canEdit}
                />
              </label>
            )}

            {entity.type === 'yarn' && (
              <label className="form-field">
                <span>Treatment Specification</span>
                <input
                  type="text"
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  placeholder="e.g. Twisting @ 1600 TPM"
                  disabled={!canEdit}
                />
              </label>
            )}
            {entity.type === 'flat_yarn' && (
              <label className="form-field">
                <span>Denier</span>
                <input value={denier} onChange={(e) => setDenier(e.target.value)}                 disabled={!canEdit} />
              </label>
            )}
            {entity.type === 'yarn' && isAdmin && (
              <>
                <label className="form-field">
                  <span>Denier</span>
                  <input value={denier} onChange={(e) => setDenier(e.target.value)} />
                </label>
                <label className="form-field">
                  <span>Twist direction</span>
                  <select value={twistDirection} onChange={(e) => setTwistDirection(e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="S">S twist</option>
                    <option value="Z">Z twist</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                {twistDirection === 'Other' && (
                  <label className="form-field">
                    <span>Other twist direction</span>
                    <input value={twistDirectionOther} onChange={(e) => setTwistDirectionOther(e.target.value)} />
                  </label>
                )}
                <label className="form-field">
                  <span>Yarn category (Optional)</span>
                  <select value={yarnCategory} onChange={(e) => setYarnCategory(e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="Sheath Yarn">Sheath Yarn</option>
                    <option value="Core Yarn">Core Yarn</option>
                    <option value="Other">Other</option>
                    {yarnCategory && !['Sheath Yarn', 'Core Yarn', 'Other'].includes(yarnCategory) && (
                      <option value={yarnCategory}>Existing value: {yarnCategory}</option>
                    )}
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="form-grid-2">
            <label className="form-field">
              <span>When batch happened</span>
              <input type="datetime-local" required value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
              <small className="field-hint">System record time is retained separately in the audit history.</small>
            </label>
            {entity.type === 'rope' && isAdmin && (
              <label className="form-field">
                <span>Target length for material estimate (m)</span>
                <input type="number" min="0" step="any" value={ropeTargetLength} onChange={(e) => setRopeTargetLength(e.target.value)} />
              </label>
            )}
            {entity.type === 'rope' && isAdmin && (
              <label className="form-field">
                <span>Grams per meter</span>
                <input type="number" min="0" step="any" value={ropeGramsPerMeter} onChange={(e) => setRopeGramsPerMeter(e.target.value)} />
              </label>
            )}
          </div>

          <div className="form-grid-2">
            <label className="form-field">
              <span>{entity.type === 'yarn' ? 'Actual output quantity' : 'Quantity'}</span>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Recorded quantity"
              />
            </label>

            <label className="form-field">
              <span>Unit</span>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="kg">kg (Kilograms)</option>
                <option value="meters">meters</option>
                <option value="coils">coils</option>
                <option value="spools">spools</option>
                <option value="lbs">lbs</option>
              </select>
            </label>
          </div>

          {entity.type === 'yarn' && (
            <div className="form-grid-2">
              <label className="form-field">
                <span>Wastage estimate (%)</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={wastagePercentage}
                  onChange={(e) => setWastagePercentage(e.target.value)}
                  placeholder="e.g. 3.5"
                />
              </label>
              <label className="form-field">
                <span>Estimated output ({unit})</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={estimatedOutput}
                  onChange={(e) => setEstimatedOutput(e.target.value)}
                  placeholder="Estimate from input and wastage"
                />
              </label>
            </div>
          )}

          {entity.type === 'flat_yarn' && isAdmin && (
            <div className="form-grid-2">
              <label className="form-field">
                <span>Critical stock threshold</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={criticalThreshold}
                  onChange={(e) => setCriticalThreshold(e.target.value)}
                  placeholder="e.g. 50"
                />
              </label>

              <label className="form-field">
                <span>Threshold unit</span>
                <select value={criticalThresholdUnit} onChange={(e) => setCriticalThresholdUnit(e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="meters">meters</option>
                  <option value="coils">coils</option>
                  <option value="spools">spools</option>
                  <option value="lbs">lbs</option>
                </select>
              </label>
            </div>
          )}

          <label className="form-field">
            <span>Remarks & Observations</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational notes, observations, or special instructions..."
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving...' : 'Update & Record Audit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
