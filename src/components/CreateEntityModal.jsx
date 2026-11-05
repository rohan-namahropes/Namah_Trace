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

function getNextYarnSequence(baseBatchId, yarns, parentEntityId, specification) {
  const prefix = `${baseBatchId}-`
  let highestSequence = 0
  let matchingRuns = 0
  for (const yarn of yarns) {
    if (yarn.batch_id?.startsWith(prefix)) {
      const suffix = yarn.batch_id.slice(prefix.length)
      if (/^\d+$/.test(suffix)) highestSequence = Math.max(highestSequence, Number(suffix))
    }
    if (
      yarn.parentEntityIds?.includes(parentEntityId)
      && yarn.treatment === specification.treatment
      && (yarn.denier || null) === specification.denier
      && (yarn.twist_direction || null) === specification.twistDirection
      && (yarn.twist_direction_other || null) === specification.twistDirectionOther
    ) {
      matchingRuns += 1
    }
  }
  return Math.max(highestSequence, matchingRuns) + 1
}

function getCurrentLocalDateTime() {
  const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function makeRopeLotId(family, diameter, batchNumber, occurredAt) {
  const date = String(occurredAt || '').slice(0, 10)
  if (!family || !diameter.trim() || !batchNumber.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return ''
  const dateCode = `${date.slice(8, 10)}${date.slice(5, 7)}${date.slice(2, 4)}`
  return `${family}-${diameter.trim().replace(/\s*mm$/i, '')}-${batchNumber.trim()}-${dateCode}`
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
  const [flatDenier, setFlatDenier] = useState('')
  const [flatQuantity, setFlatQuantity] = useState('')
  const [flatUnit, setFlatUnit] = useState('kg')
  const [flatOccurredAt, setFlatOccurredAt] = useState(() => getCurrentLocalDateTime())
  const [flatCriticalThreshold, setFlatCriticalThreshold] = useState('')
  const [flatNotes, setFlatNotes] = useState('')

  // Yarn fields
  const [yarnBatchId, setYarnBatchId] = useState(() => {
    const parent = availableFlatYarns.find((entity) => (
      entity.consumptionKnown
      && entity.quantityRemaining > 0
      && !entity.batch_id?.toUpperCase().startsWith('INTAKE-')
    ))
    return parent ? `${parent.batch_id}-T` : ''
  })
  const [selectedParentFlatYarnId, setSelectedParentFlatYarnId] = useState(
    availableFlatYarns.find((entity) => (
      entity.consumptionKnown
      && entity.quantityRemaining > 0
      && !entity.batch_id?.toUpperCase().startsWith('INTAKE-')
    ))?.id || ''
  )
  const [yarnProcessType, setYarnProcessType] = useState('T')
  const [yarnPatternValue, setYarnPatternValue] = useState('')
  const [yarnTwistDirection, setYarnTwistDirection] = useState('')
  const [yarnTwistOther, setYarnTwistOther] = useState('')
  const [yarnTwistType, setYarnTwistType] = useState('')
  const [yarnTwistTypeOther, setYarnTwistTypeOther] = useState('')
  const [yarnCategory, setYarnCategory] = useState('')
  const [yarnOccurredAt, setYarnOccurredAt] = useState(() => getCurrentLocalDateTime())
  const [yarnInputQuantity, setYarnInputQuantity] = useState('')
  const [yarnOutputQuantity, setYarnOutputQuantity] = useState('')
  const [yarnUnit, setYarnUnit] = useState('kg')
  const [wastagePercentage, setWastagePercentage] = useState('3.5')
  const [yarnRemarks, setYarnRemarks] = useState('')

  // Rope fields
  const [ropeFamily, setRopeFamily] = useState('NL')
  const [ropeDiameter, setRopeDiameter] = useState('')
  const [ropeBatchNumber, setRopeBatchNumber] = useState('')
  const [selectedParentYarnIds, setSelectedParentYarnIds] = useState([])
  const [ropeInputQuantities, setRopeInputQuantities] = useState({})
  const [ropeComponents, setRopeComponents] = useState({})
  const [ropeQuantity, setRopeQuantity] = useState('')
  const [ropeTargetLength, setRopeTargetLength] = useState('')
  const [ropeGramsPerMeter, setRopeGramsPerMeter] = useState('')
  const [ropeUnit, setRopeUnit] = useState('meters')
  const [ropeOccurredAt, setRopeOccurredAt] = useState(() => getCurrentLocalDateTime())
  const [ropeNotes, setRopeNotes] = useState('')
  const ropeBatchId = makeRopeLotId(ropeFamily, ropeDiameter, ropeBatchNumber, ropeOccurredAt)

  const hasAvailableMaterial = (entity) =>
    entity?.consumptionKnown
    && entity.quantityRemaining > 0
    && !entity.batch_id?.toUpperCase().startsWith('INTAKE-')

  const selectedFlatYarn = availableFlatYarns.find((entity) => entity.id === selectedParentFlatYarnId)
  const ropeCalculatedTotalKg = ropeTargetLength && ropeGramsPerMeter
    && Number.isFinite(Number(ropeTargetLength))
    && Number.isFinite(Number(ropeGramsPerMeter))
    && Number(ropeTargetLength) > 0
    && Number(ropeGramsPerMeter) > 0
    ? Number(ropeTargetLength) * Number(ropeGramsPerMeter) / 1000
    : null
  const ropeCompositionTotal = selectedParentYarnIds.reduce(
    (total, parentId) => total + Number(ropeComponents[parentId]?.percentage || 0),
    0
  )
  const weightInParentUnit = (weightKg, unit) => {
    const normalizedUnit = String(unit || '').trim().toLowerCase()
    if (normalizedUnit === 'kg') return weightKg
    if (normalizedUnit === 'lbs') return weightKg * 2.2046226218
    return null
  }
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
  const updateYarnBatchId = (
    parent = selectedFlatYarn,
    processType = yarnProcessType,
    patternValue = yarnPatternValue,
    twistDirection = yarnTwistDirection,
    twistDirectionOther = yarnTwistOther,
  ) => {
    const suffix = normalizeYarnPattern(patternValue)
    if (!parent) return

    const directionSuffix = twistDirection === 'Other'
      ? `OTHER-${normalizeYarnPattern(twistDirectionOther)}`
      : twistDirection
    setYarnBatchId([
      parent.batch_id,
      `${processType}${suffix}`,
      directionSuffix,
    ].filter(Boolean).join('-'))
  }
  const yarnTreatment = yarnProcessType === 'T'
    ? `Twisting ${yarnPatternValue.trim()} denier`
    : `Plying ${yarnPatternValue.trim()}`
  const nextYarnSequence = yarnBatchId
    ? getNextYarnSequence(yarnBatchId.trim(), availableYarns, selectedParentFlatYarnId, {
      treatment: yarnTreatment,
      denier: yarnProcessType === 'T' ? yarnPatternValue.trim() : null,
      twistDirection: yarnTwistDirection || null,
      twistDirectionOther: yarnTwistDirection === 'Other' ? yarnTwistOther.trim() || null : null,
    })
    : null

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
        if (!supplier.trim()) throw new Error('Supplier is required (e.g. ABC).')

        const res = await onCreateFlatYarn({
          batchId: flatBatchId.trim(),
          supplier: supplier.trim(),
          denier: flatDenier.trim(),
          quantity: flatQuantity ? Number(flatQuantity) : null,
          unit: flatUnit,
          occurredAt: flatOccurredAt,
          criticalQuantityThreshold: isAdmin && flatCriticalThreshold !== ''
            ? Number(flatCriticalThreshold)
            : null,
          criticalQuantityThresholdUnit: flatUnit,
          notes: flatNotes.trim(),
        })
        if (res.error) throw res.error
      } else if (entityType === 'yarn') {
        if (!yarnBatchId.trim()) throw new Error('Yarn lot base ID is required.')
        if (!selectedParentFlatYarnId) throw new Error('You must select exactly one parent Flat Yarn batch.')
        if (!yarnPatternValue.trim()) throw new Error('Enter a denier or plying value.')
        if (!yarnTwistDirection) throw new Error('Select the Yarn twist direction.')
        if (yarnTwistDirection === 'Other' && !yarnTwistOther.trim()) {
          throw new Error('Describe the other Yarn twist direction.')
        }
        if (yarnProcessType === 'T' && !yarnTwistType) {
          throw new Error('Select the twist type.')
        }
        if (yarnProcessType === 'T' && yarnTwistType === 'Custom' && !yarnTwistTypeOther.trim()) {
          throw new Error('Describe the custom twist type.')
        }
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
          treatment: yarnTreatment,
          denier: yarnProcessType === 'T' ? yarnPatternValue.trim() : '',
          twistDirection: yarnTwistDirection,
          twistDirectionOther: yarnTwistOther.trim(),
          twistType: yarnProcessType === 'T' ? yarnTwistType : null,
          twistTypeOther: yarnProcessType === 'T' && yarnTwistType === 'Custom'
            ? yarnTwistTypeOther.trim()
            : null,
          yarnCategory,
          occurredAt: yarnOccurredAt,
          inputQuantity: Number(yarnInputQuantity),
          inputUnit: flatParent?.unit,
          quantity: yarnOutputQuantity ? Number(yarnOutputQuantity) : null,
          wastagePercentage: Number(wastagePercentage),
          unit: yarnUnit,
          remarks: yarnRemarks.trim(),
        })
        if (res.error) throw res.error
      } else if (entityType === 'rope') {
        if (!ropeFamily || !ropeDiameter.trim() || !ropeBatchNumber.trim()) {
          throw new Error('Select Rope family and enter the diameter and batch number.')
        }
        if (selectedParentYarnIds.length === 0) {
          throw new Error('You must select at least one parent Yarn Batch for composition.')
        }
        if (Boolean(ropeTargetLength) !== Boolean(ropeGramsPerMeter)) {
          throw new Error('Enter both target length and grams per meter to calculate Rope material, or leave both empty.')
        }
        if (ropeTargetLength && (!Number.isFinite(Number(ropeTargetLength)) || Number(ropeTargetLength) <= 0)) {
          throw new Error('Target length must be a finite, positive number.')
        }
        if (ropeGramsPerMeter && (!Number.isFinite(Number(ropeGramsPerMeter)) || Number(ropeGramsPerMeter) <= 0)) {
          throw new Error('Grams per meter must be a finite, positive number.')
        }
        if (Math.abs(ropeCompositionTotal - 100) > 0.000001) {
          throw new Error('Yarn component percentages must total 100%.')
        }
        const allocations = selectedParentYarnIds.map((parentEntityId) => {
          const parent = availableYarns.find((item) => item.id === parentEntityId)
          const component = ropeComponents[parentEntityId] || {}
          if (!String(component.role || '').trim()) {
            throw new Error(`Enter a component role for Yarn Batch ${parent?.batch_id || ''}.`)
          }
          if (!Number.isFinite(Number(component.percentage)) || Number(component.percentage) <= 0) {
            throw new Error(`Enter a positive composition percentage for Yarn Batch ${parent?.batch_id || ''}.`)
          }
          const calculatedKg = ropeCalculatedTotalKg == null
            ? null
            : ropeCalculatedTotalKg * Number(component.percentage) / 100
          const inputQuantity = calculatedKg == null
            ? ropeInputQuantities[parentEntityId]
            : weightInParentUnit(calculatedKg, parent?.unit)
          if (calculatedKg != null && inputQuantity == null) {
            throw new Error(`Calculated Rope composition requires Yarn Batch ${parent?.batch_id} to use kg or lbs.`)
          }
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
            componentRole: String(component.role).trim(),
            compositionPercentage: Number(component.percentage),
          }
        })

        const res = await onCreateRopeBatch({
          batchId: ropeBatchId,
          ropeFamily,
          ropeDiameter: ropeDiameter.trim().replace(/\s*mm$/i, ''),
          allocations,
          quantity: ropeQuantity ? Number(ropeQuantity) : null,
          unit: ropeUnit,
          notes: ropeNotes.trim(),
          targetLength: ropeTargetLength ? Number(ropeTargetLength) : null,
          gramsPerMeter: ropeGramsPerMeter ? Number(ropeGramsPerMeter) : null,
          occurredAt: ropeOccurredAt,
        })
        if (res.error) throw res.error
      }

      onClose()
    } catch (err) {
      if (err.operationCommitted) {
        onClose()
        setBusy(false)
        return
      }
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
                  <span>Batch Identifier (Optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. 523"
                    value={flatBatchId}
                    onChange={(e) => setFlatBatchId(e.target.value)}
                  />
                  <small className="field-hint">
                    Leave blank for a temporary company/date reference. Assign a batch ID before using this intake for Yarn.
                  </small>
                </label>

                <label className="form-field">
                  <span>Company / Supplier *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ABC"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                  />
                  <small className="field-hint">Company name used in the temporary reference if no batch ID is provided.</small>
                </label>
              </div>

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Denier (Optional)</span>
                  <input
                    type="text"
                    placeholder="Incoming Flat Yarn denier"
                    value={flatDenier}
                    onChange={(e) => setFlatDenier(e.target.value)}
                  />
                </label>

                <label className="form-field">
                  <span>Received Weight / Quantity (Optional)</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 500"
                    value={flatQuantity}
                    onChange={(e) => setFlatQuantity(e.target.value)}
                  />
                </label>
              </div>
              <div className="form-grid-2">
                <label className="form-field">
                  <span>Unit</span>
                  <select value={flatUnit} onChange={(e) => setFlatUnit(e.target.value)}>
                    <option value="kg">kg (Kilograms)</option>
                    <option value="lbs">lbs (Pounds)</option>
                    <option value="meters">meters</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>When received</span>
                  <input
                    type="datetime-local"
                    required
                    value={flatOccurredAt}
                    onChange={(e) => setFlatOccurredAt(e.target.value)}
                  />
                  <small className="field-hint">Record time is saved separately automatically.</small>
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
                    inputMode="text"
                    placeholder={yarnProcessType === 'T' ? 'Enter denier or choose a common value' : 'Enter plying value'}
                    value={yarnPatternValue}
                    onChange={(e) => {
                      setYarnPatternValue(e.target.value)
                      updateYarnBatchId(selectedFlatYarn, yarnProcessType, e.target.value)
                    }}
                  />
                  {yarnProcessType === 'T' && (
                    <div className="yarn-denier-choices" aria-label="Common denier values">
                      {['1680', '2520', '3360', '9600 1/3'].map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`preset-chip-btn ${yarnPatternValue === value ? 'active' : ''}`}
                          aria-pressed={yarnPatternValue === value}
                          onClick={() => {
                            setYarnPatternValue(value)
                            updateYarnBatchId(selectedFlatYarn, yarnProcessType, value)
                          }}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  )}
                </label>
              </div>

              {yarnProcessType === 'T' && (
                <div className="form-field">
                  <span>Twist type *</span>
                  <div className="yarn-twist-type-choices" role="group" aria-label="Twist type">
                    {['Type 1', 'Type 2', 'Custom'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`preset-chip-btn ${yarnTwistType === type ? 'active' : ''}`}
                        aria-pressed={yarnTwistType === type}
                        onClick={() => setYarnTwistType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {yarnTwistType === 'Custom' && (
                    <input
                      type="text"
                      required
                      placeholder="Describe the twist type"
                      value={yarnTwistTypeOther}
                      onChange={(event) => setYarnTwistTypeOther(event.target.value)}
                    />
                  )}
                  <small className="field-hint">Choose the twisting process used for this Yarn batch.</small>
                </div>
              )}

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Twist direction *</span>
                  <select
                    value={yarnTwistDirection}
                    onChange={(e) => {
                      setYarnTwistDirection(e.target.value)
                      updateYarnBatchId(selectedFlatYarn, yarnProcessType, yarnPatternValue, e.target.value)
                    }}
                  >
                    <option value="">Select direction</option>
                    <option value="S">S twist</option>
                    <option value="Z">Z twist</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Yarn category (Optional)</span>
                  <select value={yarnCategory} onChange={(e) => setYarnCategory(e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="Sheath Yarn">Sheath Yarn</option>
                    <option value="Core Yarn">Core Yarn</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
              </div>
              {yarnTwistDirection === 'Other' && (
                <div className="form-grid-2">
                  {yarnTwistDirection === 'Other' ? (
                    <label className="form-field">
                      <span>Other twist direction *</span>
                      <input
                        value={yarnTwistOther}
                        onChange={(e) => {
                          setYarnTwistOther(e.target.value)
                          updateYarnBatchId(
                            selectedFlatYarn,
                            yarnProcessType,
                            yarnPatternValue,
                            'Other',
                            e.target.value
                          )
                        }}
                      />
                    </label>
                  ) : <span />}
                </div>
              )}

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Yarn lot base ID *</span>
                  <input
                    type="text"
                    required
                    placeholder="Source batch + process + direction"
                    value={yarnBatchId}
                    onChange={(e) => setYarnBatchId(e.target.value)}
                  />
                  <small className="field-hint">A unique sequence suffix is assigned for each production run.</small>
                </label>
                <label className="form-field">
                  <span>When manufactured</span>
                  <input
                    type="datetime-local"
                    required
                    value={yarnOccurredAt}
                    onChange={(e) => setYarnOccurredAt(e.target.value)}
                  />
                </label>
              </div>
              {nextYarnSequence != null && (
                <div className="form-info-callout blue" role="status">
                  <strong>This will be Yarn sequence {nextYarnSequence}.</strong>
                  <p>
                    Expected lot ID: {yarnBatchId}-{String(nextYarnSequence).padStart(2, '0')}.
                    The server confirms the sequence when the batch is saved.
                  </p>
                </div>
              )}

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
                const component = ropeComponents[parentId] || {}
                const calculatedKg = ropeCalculatedTotalKg == null
                  ? null
                  : ropeCalculatedTotalKg * Number(component.percentage || 0) / 100
                const calculatedQuantity = calculatedKg == null
                  ? null
                  : weightInParentUnit(calculatedKg, parent?.unit)
                return (
                  <div className="form-grid-3" key={parentId}>
                    <label className="form-field">
                      <span>Component role · {parent?.batch_id} *</span>
                      <input
                        required
                        placeholder="e.g. Sheath or Core"
                        value={component.role || ''}
                        onChange={(e) => setRopeComponents((current) => ({
                          ...current,
                          [parentId]: { ...current[parentId], role: e.target.value },
                        }))}
                      />
                    </label>
                    <label className="form-field">
                      <span>Composition (%) *</span>
                      <input
                        type="number"
                        step="any"
                        min="0.000001"
                        max="100"
                        required
                        value={component.percentage || ''}
                        onChange={(e) => setRopeComponents((current) => ({
                          ...current,
                          [parentId]: { ...current[parentId], percentage: e.target.value },
                        }))}
                      />
                    </label>
                    <label className="form-field">
                      <span>Material consumed ({parent?.unit}) *</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        max={parent?.quantityRemaining}
                        readOnly={calculatedQuantity != null}
                        value={calculatedQuantity == null
                          ? ropeInputQuantities[parentId] || ''
                          : calculatedQuantity.toFixed(4).replace(/\.?0+$/, '')}
                        onChange={(e) => setRopeInputQuantities((current) => ({
                          ...current,
                          [parentId]: e.target.value,
                        }))}
                        placeholder={`Available: ${parent?.quantityRemaining}`}
                      />
                      <small className="field-hint">
                        {calculatedQuantity == null
                          ? `Available: ${parent?.quantityRemaining} ${parent?.unit}`
                          : `Calculated from total ${ropeCalculatedTotalKg.toFixed(3)} kg`}
                      </small>
                    </label>
                  </div>
                )
              })}
              <div className="form-info-callout blue">
                <strong>Composition total: {ropeCompositionTotal.toFixed(2)}%</strong>
                <p>Enter each selected Yarn batch’s role and share. Shares must total 100%.</p>
              </div>

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Rope family *</span>
                  <select value={ropeFamily} onChange={(e) => setRopeFamily(e.target.value)}>
                    <option value="NL">Namah Lynx (Dynamic) · NL</option>
                    <option value="NI">Namah Indus (Static) · NI</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Diameter (mm) *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10.5"
                    value={ropeDiameter}
                    onChange={(e) => setRopeDiameter(e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Rope batch number *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5419"
                    value={ropeBatchNumber}
                    onChange={(e) => setRopeBatchNumber(e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>When manufactured</span>
                  <input
                    type="datetime-local"
                    required
                    value={ropeOccurredAt}
                    onChange={(e) => setRopeOccurredAt(e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Generated Rope lot ID</span>
                  <input type="text" value={ropeBatchId} readOnly placeholder="Select family, diameter, batch, and date" />
                  <small className="field-hint">Spool and coil numbers are separate downstream and are not tracked here.</small>
                </label>

                <label className="form-field">
                  <span>Target rope length for material estimate (Optional)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 1000"
                    value={ropeTargetLength}
                    onChange={(e) => setRopeTargetLength(e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Grams per meter (Optional)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 75.5"
                    value={ropeGramsPerMeter}
                    onChange={(e) => setRopeGramsPerMeter(e.target.value)}
                  />
                </label>
              </div>
              {ropeCalculatedTotalKg != null && (
                <div className="form-info-callout blue">
                  <strong>Estimated total material: {ropeCalculatedTotalKg.toFixed(3)} kg</strong>
                  <p>Calculated as target length × grams per meter ÷ 1,000.</p>
                </div>
              )}

              <div className="form-grid-2">
                <label className="form-field">
                  <span>Actual manufactured quantity (Optional)</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Produced quantity"
                    value={ropeQuantity}
                    onChange={(e) => setRopeQuantity(e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Output unit</span>
                  <select value={ropeUnit} onChange={(e) => setRopeUnit(e.target.value)}>
                    <option value="meters">meters</option>
                    <option value="coils">coils</option>
                    <option value="feet">feet</option>
                    <option value="kg">kg</option>
                  </select>
                </label>
              </div>
              <div className="form-grid-2">
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
