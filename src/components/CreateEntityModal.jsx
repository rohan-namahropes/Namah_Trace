import React, { useState } from 'react'
import {
  X,
  Layers,
  Cpu,
  Anchor,
  Plus,
  ArrowRight,
  AlertCircle,
  Check,
} from 'lucide-react'

function normalizeYarnPattern(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/]+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
}

export function CreateEntityModal({
  initialType = 'flat_yarn',
  availableFlatYarns = [],
  availableYarns = [],
  isAdmin = false,
  onClose,
  onCreateFlatYarn,
  onCreateYarnBatch,
  onCreateRopeBatch,
}) {
  const [entityType, setEntityType] = useState(initialType)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Flat Yarn fields
  const [flatBatchId, setFlatBatchId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [flatQuantity, setFlatQuantity] = useState('')
  const [flatUnit, setFlatUnit] = useState('kg')
  const [flatCriticalThreshold, setFlatCriticalThreshold] = useState('')
  const [flatNotes, setFlatNotes] = useState('')

  // Yarn fields
  const [yarnBatchId, setYarnBatchId] = useState(() => {
    const parent = availableFlatYarns.find((entity) => entity.consumptionKnown && entity.quantityRemaining > 0)
    return parent ? `${parent.batch_id}-T1680` : ''
  })
  const [selectedParentFlatYarnId, setSelectedParentFlatYarnId] = useState(
    availableFlatYarns.find((entity) => entity.consumptionKnown && entity.quantityRemaining > 0)?.id || ''
  )
  const [yarnProcessType, setYarnProcessType] = useState('T')
  const [yarnPatternValue, setYarnPatternValue] = useState('1680')
  const [yarnInputQuantity, setYarnInputQuantity] = useState('')
  const [yarnOutputQuantity, setYarnOutputQuantity] = useState('')
  const [yarnUnit, setYarnUnit] = useState('kg')
  const [wastagePercentage, setWastagePercentage] = useState('3.5')
  const [yarnRemarks, setYarnRemarks] = useState('')

  // Rope fields
  const [ropeBatchId, setRopeBatchId] = useState('')
  const [selectedParentYarnIds, setSelectedParentYarnIds] = useState([])
  const [ropeInputQuantities, setRopeInputQuantities] = useState({})
  const [ropeQuantity, setRopeQuantity] = useState('')
  const [ropeUnit, setRopeUnit] = useState('meters')
  const [ropeNotes, setRopeNotes] = useState('')

  const hasAvailableMaterial = (entity) =>
    entity?.consumptionKnown && entity.quantityRemaining > 0

  const selectedFlatYarn = availableFlatYarns.find((entity) => entity.id === selectedParentFlatYarnId)
  const estimatedYarnOutput = selectedFlatYarn
    && selectedFlatYarn.unit === yarnUnit
    && yarnInputQuantity
    && Number.isFinite(Number(yarnInputQuantity))
    && Number(yarnInputQuantity) > 0
    && Number.isFinite(Number(wastagePercentage))
    && Number(wastagePercentage) >= 0
    && Number(wastagePercentage) <= 100
    ? Number(yarnInputQuantity) * (100 - Number(wastagePercentage)) / 100
    : null
  const updateYarnBatchId = (parent = selectedFlatYarn, processType = yarnProcessType, patternValue = yarnPatternValue) => {
    const suffix = normalizeYarnPattern(patternValue)
    if (parent) setYarnBatchId(`${parent.batch_id}-${processType}${suffix}`)
  }

  const handleToggleYarnSelection = (yarnId) => {
    const parent = availableYarns.find((item) => item.id === yarnId)
    if (!hasAvailableMaterial(parent)) return
    if (selectedParentYarnIds.includes(yarnId)) {
      setSelectedParentYarnIds(selectedParentYarnIds.filter((id) => id !== yarnId))
      setRopeInputQuantities((current) => {
        const next = { ...current }
        delete next[yarnId]
        return next
      })
    } else {
      setSelectedParentYarnIds([...selectedParentYarnIds, yarnId])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      if (entityType === 'flat_yarn') {
        if (!flatBatchId.trim()) throw new Error('Flat Yarn Batch ID is required (e.g. 523).')
        if (!supplier.trim()) throw new Error('Supplier is required (e.g. ABC).')

        const res = await onCreateFlatYarn({
          batchId: flatBatchId.trim(),
          supplier: supplier.trim(),
          quantity: flatQuantity ? Number(flatQuantity) : null,
          unit: flatUnit,
          criticalQuantityThreshold: isAdmin && flatCriticalThreshold !== ''
            ? Number(flatCriticalThreshold)
            : null,
          criticalQuantityThresholdUnit: flatUnit,
          notes: flatNotes.trim(),
        })
        if (res.error) throw res.error
      } else if (entityType === 'yarn') {
        if (!yarnBatchId.trim()) throw new Error('Yarn Batch ID is required (e.g. 123-T1680 or 123-Pvalue).')
        if (!selectedParentFlatYarnId) throw new Error('You must select exactly one parent Flat Yarn batch.')
        if (!yarnPatternValue.trim()) throw new Error('Enter a denier or plying value.')
        if (
          !Number.isFinite(Number(wastagePercentage))
          || Number(wastagePercentage) < 0
          || Number(wastagePercentage) > 100
        ) {
          throw new Error('Wastage percentage must be between 0 and 100.')
        }
        if (!yarnInputQuantity || Number(yarnInputQuantity) <= 0) {
          throw new Error('Quantity consumed from the Flat Yarn parent is required.')
        }
        const flatParent = availableFlatYarns.find((fy) => fy.id === selectedParentFlatYarnId)
        if (Number(yarnInputQuantity) > Number(flatParent?.quantityRemaining)) {
          throw new Error(`Requested quantity exceeds the ${flatParent?.quantityRemaining} ${flatParent?.unit} available.`)
        }

        const res = await onCreateYarnBatch({
          batchId: yarnBatchId.trim(),
          parentEntityId: selectedParentFlatYarnId,
          treatment: yarnProcessType === 'T'
            ? `Twisting ${yarnPatternValue.trim()} denier`
            : `Plying ${yarnPatternValue.trim()}`,
          inputQuantity: Number(yarnInputQuantity),
          inputUnit: flatParent?.unit,
          quantity: yarnOutputQuantity ? Number(yarnOutputQuantity) : null,
          wastagePercentage: Number(wastagePercentage),
          unit: yarnUnit,
          remarks: yarnRemarks.trim(),
        })
        if (res.error) throw res.error
      } else if (entityType === 'rope') {
        if (!ropeBatchId.trim()) throw new Error('Rope Batch ID is required (e.g. 5417).')
        if (selectedParentYarnIds.length === 0) {
          throw new Error('You must select at least one parent Yarn Batch for composition.')
        }
        const allocations = selectedParentYarnIds.map((parentEntityId) => {
          const parent = availableYarns.find((item) => item.id === parentEntityId)
          const inputQuantity = ropeInputQuantities[parentEntityId]
          if (!inputQuantity || Number(inputQuantity) <= 0) {
            throw new Error(`Enter a positive quantity consumed from Yarn Batch ${parent?.batch_id || ''}.`)
          }
          if (Number(inputQuantity) > Number(parent?.quantityRemaining)) {
            throw new Error(`Requested quantity exceeds the ${parent?.quantityRemaining} ${parent?.unit} available in Yarn Batch ${parent?.batch_id}.`)
          }
          return {
            parentEntityId,
            quantity: Number(inputQuantity),
            unit: parent?.unit,
          }
        })

        const res = await onCreateRopeBatch({
          batchId: ropeBatchId.trim(),
          allocations,
          quantity: ropeQuantity ? Number(ropeQuantity) : null,
          unit: ropeUnit,
          notes: ropeNotes.trim(),
        })
        if (res.error) throw res.error
      }

      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create entity')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog create-entity-modal">
        {/* Modal Header */}
        <div className="modal-head">
          <div>
            <h2>Register New Batch</h2>
            <p className="modal-subtitle">
              Select the manufacturing tier and specify initial batch information.
            </p>
          </div>
          <button className="icon-button modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Entity Tier Selector Tabs */}
        <div className="tier-selector-tabs">
          <button
            type="button"
            className={`tier-tab-btn ${entityType === 'flat_yarn' ? 'active amber' : ''}`}
            onClick={() => setEntityType('flat_yarn')}
          >
            <Layers size={16} />
            <div>
              <strong>1. Flat Yarn</strong>
              <small>Incoming Raw</small>
            </div>
          </button>
          <button
            type="button"
            className={`tier-tab-btn ${entityType === 'yarn' ? 'active blue' : ''}`}
            onClick={() => setEntityType('yarn')}
          >
            <Cpu size={16} />
            <div>
              <strong>2. Yarn Batch</strong>
              <small>Derived Processed</small>
            </div>
          </button>
          <button
            type="button"
            className={`tier-tab-btn ${entityType === 'rope' ? 'active navy' : ''}`}
            onClick={() => setEntityType('rope')}
          >
            <Anchor size={16} />
            <div>
              <strong>3. Rope Batch</strong>
              <small>Finished Assembly</small>
            </div>
          </button>
        </div>

        {error && (
          <div className="modal-error-alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* TIER 1: FLAT YARN FORM */}
          {entityType === 'flat_yarn' && (
            <div className="tier-form-fields">
              <div className="form-info-callout amber">
                <strong>Flat Yarn Creation</strong>
                <p>Creation is intentionally lightweight. You can progressively add parameters, test data, and remarks after creation.</p>
              </div>

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Batch Identifier *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 523"
                    value={flatBatchId}
                    onChange={(e) => setFlatBatchId(e.target.value)}
                  />
                  <small className="field-hint">Human-readable raw batch number</small>
                </label>

                <label className="form-field">
                  <span>Supplier *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ABC"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                  />
                  <small className="field-hint">Incoming material vendor/supplier</small>
                </label>
              </div>

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Initial Quantity (Optional)</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 500"
                    value={flatQuantity}
                    onChange={(e) => setFlatQuantity(e.target.value)}
                  />
                </label>

                <label className="form-field">
                  <span>Unit</span>
                  <select value={flatUnit} onChange={(e) => setFlatUnit(e.target.value)}>
                    <option value="kg">kg (Kilograms)</option>
                    <option value="lbs">lbs (Pounds)</option>
                    <option value="meters">meters</option>
                  </select>
                </label>
              </div>

              {isAdmin && (
                <label className="form-field">
                  <span>Critical stock alert below ({flatUnit})</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={flatCriticalThreshold}
                    onChange={(e) => setFlatCriticalThreshold(e.target.value)}
                    placeholder="Optional threshold"
                  />
                  <small className="field-hint">Alert when known remaining stock falls below this amount.</small>
                </label>
              )}

              <label className="form-field">
                <span>Remarks / Notes</span>
                <textarea
                  rows={3}
                  placeholder="Optional observations regarding luster, packing condition, etc."
                  value={flatNotes}
                  onChange={(e) => setFlatNotes(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* TIER 2: YARN BATCH FORM */}
          {entityType === 'yarn' && (
            <div className="tier-form-fields">
              <div className="form-info-callout blue">
                <strong>Yarn Batch Creation</strong>
                <p>A Yarn Batch is derived from exactly one parent Flat Yarn Batch. The genealogical link is preserved automatically.</p>
              </div>

              <label className="form-field">
                <span>Select Parent Flat Yarn Batch *</span>
                <select
                  required
                  value={selectedParentFlatYarnId}
                  onChange={(e) => {
                    const parent = availableFlatYarns.find((item) => item.id === e.target.value)
                    setSelectedParentFlatYarnId(e.target.value)
                    if (parent) {
                      updateYarnBatchId(parent)
                      setYarnUnit(parent.unit || 'kg')
                    }
                  }}
                >
                  <option value="">-- Choose Flat Yarn Source --</option>
                  {availableFlatYarns.map((fy) => (
                    <option key={fy.id} value={fy.id} disabled={!hasAvailableMaterial(fy)}>
                      Batch {fy.batch_id} (Supplier: {fy.supplier || 'N/A'} · Available: {fy.consumptionKnown ? `${fy.quantityRemaining} ${fy.unit}` : 'Unknown'})
                    </option>
                  ))}
                </select>
                {availableFlatYarns.length === 0 && (
                  <small className="field-warning">No Flat Yarn batches available. Please create one first.</small>
                )}
              </label>

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Yarn process *</span>
                  <select
                    value={yarnProcessType}
                    onChange={(e) => {
                      setYarnProcessType(e.target.value)
                      updateYarnBatchId(selectedFlatYarn, e.target.value)
                    }}
                  >
                    <option value="T">Twisting</option>
                    <option value="P">Plying</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>{yarnProcessType === 'T' ? 'Denier *' : 'Plying value *'}</span>
                  <input
                    type="text"
                    required
                    list={yarnProcessType === 'T' ? 'twisting-denier-options' : undefined}
                    placeholder={yarnProcessType === 'T' ? 'e.g. 1680' : 'Enter plying value'}
                    value={yarnPatternValue}
                    onChange={(e) => {
                      setYarnPatternValue(e.target.value)
                      updateYarnBatchId(selectedFlatYarn, yarnProcessType, e.target.value)
                    }}
                  />
                  {yarnProcessType === 'T' && (
                    <datalist id="twisting-denier-options">
                      <option value="1680" />
                      <option value="2520" />
                      <option value="3360" />
                      <option value="9600 1/3" />
                    </datalist>
                  )}
                </label>
              </div>

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Generated Yarn Batch ID *</span>
                  <input
                    type="text"
                    required
                    placeholder="Parent batch + yarn pattern"
                    value={yarnBatchId}
                    onChange={(e) => setYarnBatchId(e.target.value)}
                  />
                  <small className="field-hint">Generated from the parent batch and pattern; edit only if needed to avoid a duplicate ID.</small>
                </label>
              </div>

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Quantity Consumed from Flat Yarn *</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    max={selectedFlatYarn?.quantityRemaining}
                    disabled={!hasAvailableMaterial(selectedFlatYarn)}
                    placeholder="e.g. 100"
                    value={yarnInputQuantity}
                    onChange={(e) => setYarnInputQuantity(e.target.value)}
                  />
                  <small className="field-hint">
                    Available: {selectedFlatYarn?.consumptionKnown
                      ? `${selectedFlatYarn.quantityRemaining} ${selectedFlatYarn.unit}`
                      : 'Unknown'}
                  </small>
                </label>

                <label className="form-field">
                  <span>Wastage estimate (%)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={wastagePercentage}
                    onChange={(e) => setWastagePercentage(e.target.value)}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Estimated output</span>
                  <input
                    type="text"
                    value={estimatedYarnOutput == null
                      ? 'Unavailable: input/output units differ or input is unknown'
                      : `${estimatedYarnOutput} ${yarnUnit} (estimate)`}
                    disabled
                  />
                </label>

                <label className="form-field">
                  <span>Actual output quantity (Optional)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Produced quantity"
                    value={yarnOutputQuantity}
                    onChange={(e) => setYarnOutputQuantity(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <span>Input Unit</span>
                  <input
                    type="text"
                    value={availableFlatYarns.find((fy) => fy.id === selectedParentFlatYarnId)?.unit || ''}
                    disabled
                  />
                </div>

                <label className="form-field">
                  <span>Yarn Output Unit</span>
                  <select value={yarnUnit} onChange={(e) => setYarnUnit(e.target.value)}>
                    <option value="kg">kg (Kilograms)</option>
                    <option value="meters">meters</option>
                    <option value="lbs">lbs</option>
                    <option value="spools">spools</option>
                    <option value="coils">coils</option>
                  </select>
                </label>
              </div>

              <label className="form-field">
                <span>Remarks / Process Notes</span>
                <textarea
                  rows={2}
                  placeholder="Notes on machine number, spindle speed, intended role..."
                  value={yarnRemarks}
                  onChange={(e) => setYarnRemarks(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* TIER 3: ROPE BATCH FORM */}
          {entityType === 'rope' && (
            <div className="tier-form-fields">
              <div className="form-info-callout navy">
                <strong>Rope Batch Creation</strong>
                <p>Select one or more Yarn Batches that compose this rope. The system will track full genealogy back to the original flat yarns.</p>
              </div>

              <label className="form-field">
                <span>Select Component Yarn Batches * (Select one or more)</span>
                <div className="yarn-selection-box">
                  {availableYarns.map((yb) => {
                    const isSelected = selectedParentYarnIds.includes(yb.id)
                    return (
                      <div
                        key={yb.id}
                        className={`yarn-select-item ${isSelected ? 'selected' : ''} ${!hasAvailableMaterial(yb) ? 'unavailable' : ''}`}
                        onClick={() => handleToggleYarnSelection(yb.id)}
                        aria-disabled={!hasAvailableMaterial(yb)}
                      >
                        <div className="custom-checkbox">
                          {isSelected && <Check size={14} />}
                        </div>
                        <div className="yarn-item-text">
                          <strong>Batch {yb.batch_id}</strong>
                          <small>{yb.treatment || 'Standard'} · Available: {yb.consumptionKnown ? `${yb.quantityRemaining} ${yb.unit}` : 'Unknown'}</small>
                        </div>
                      </div>
                    )
                  })}
                  {availableYarns.length === 0 && (
                    <div className="empty-selection-notice">
                      No Yarn Batches available. Please create at least one Yarn Batch first.
                    </div>
                  )}
                </div>
                <small className="field-hint">Selected: {selectedParentYarnIds.length} yarn batches</small>
              </label>

              {selectedParentYarnIds.map((parentId) => {
                const parent = availableYarns.find((item) => item.id === parentId)
                return (
                  <label className="form-field" key={parentId}>
                    <span>Quantity Consumed from Yarn Batch {parent?.batch_id} *</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      max={parent?.quantityRemaining}
                      value={ropeInputQuantities[parentId] || ''}
                      onChange={(e) => setRopeInputQuantities((current) => ({
                        ...current,
                        [parentId]: e.target.value,
                      }))}
                      placeholder={`Available: ${parent?.quantityRemaining} ${parent?.unit}`}
                    />
                    <small className="field-hint">
                      Available: {parent?.quantityRemaining} {parent?.unit}
                    </small>
                  </label>
                )
              })}

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Rope Batch ID *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5417"
                    value={ropeBatchId}
                    onChange={(e) => setRopeBatchId(e.target.value)}
                  />
                </label>

                <label className="form-field">
                  <span>Manufactured Length / Quantity</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 300"
                    value={ropeQuantity}
                    onChange={(e) => setRopeQuantity(e.target.value)}
                  />
                </label>
              </div>

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Unit</span>
                  <select value={ropeUnit} onChange={(e) => setRopeUnit(e.target.value)}>
                    <option value="meters">meters</option>
                    <option value="coils">coils</option>
                    <option value="feet">feet</option>
                    <option value="kg">kg</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Specifications / Construction</span>
                  <input
                    type="text"
                    placeholder="e.g. 10.5mm static kernmantle"
                    value={ropeNotes}
                    onChange={(e) => setRopeNotes(e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving batch...' : 'Save & Open Record'} <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
