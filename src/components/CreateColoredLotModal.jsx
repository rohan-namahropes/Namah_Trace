import React, { useState } from 'react'
import { AlertCircle, ArrowRight, X } from 'lucide-react'

function getLocalDateTime() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  return date.toISOString().slice(0, 16)
}

export function CreateColoredLotModal({ source, onClose, onCreate }) {
  const [color, setColor] = useState('')
  const [quantityUsed, setQuantityUsed] = useState('')
  const [outputQuantity, setOutputQuantity] = useState('')
  const [outputQuantityEdited, setOutputQuantityEdited] = useState(false)
  const [occurredAt, setOccurredAt] = useState(getLocalDateTime)
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const consumed = Number(quantityUsed)
      const outputValue = outputQuantityEdited ? outputQuantity : quantityUsed
      const output = Number(outputValue)
      if (!color.trim()) throw new Error('Enter a color for the new lot.')
      if (!Number.isFinite(consumed) || consumed <= 0) {
        throw new Error('Consumed quantity must be a positive number.')
      }
      if (!Number.isFinite(output) || output < 0) {
        throw new Error('Output quantity must be a non-negative number.')
      }

      const result = await onCreate({
        parentEntityId: source.id,
        color: color.trim(),
        quantityUsed: consumed,
        outputQuantity: output,
        unit: source.unit,
        occurredAt,
        remarks: remarks.trim(),
      })
      if (result?.error && !result.error.operationCommitted) throw result.error
      onClose()
    } catch (submitError) {
      setError(submitError.message || 'Unable to create the colored lot.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="color-lot-heading">
        <div className="modal-head">
          <div>
            <h2 id="color-lot-heading">Create colored {source.type === 'flat_yarn' ? 'Flat Yarn' : 'Yarn'} lot</h2>
            <p className="modal-subtitle">Source: {source.batch_id} · Available: {source.quantityRemaining} {source.unit}</p>
          </div>
          <button type="button" className="icon-button modal-close-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {error && <div className="modal-error-alert" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Color *</span>
            <input required value={color} onChange={(event) => setColor(event.target.value)} placeholder="e.g. Black" />
          </label>
          <div className="form-grid-2">
            <label className="form-field">
              <span>Quantity consumed ({source.unit}) *</span>
              <input
                type="number" step="any" min="0.000001" max={source.quantityRemaining}
                required value={quantityUsed}
                onChange={(event) => setQuantityUsed(event.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Output quantity ({source.unit}) *</span>
              <input
                type="number" step="any" min="0" required
                value={outputQuantityEdited ? outputQuantity : quantityUsed}
                onChange={(event) => {
                  setOutputQuantity(event.target.value)
                  setOutputQuantityEdited(true)
                }}
              />
            </label>
          </div>
          <label className="form-field">
            <span>Coloring date</span>
            <input type="datetime-local" required value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Process notes</span>
            <textarea rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
          </label>
          <div className="form-info-callout amber">
            <strong>Separate, traceable output lot</strong>
            <p>
              This creates a new {source.type === 'flat_yarn' ? 'Flat Yarn' : 'Yarn'} lot with its own color, stock balance, process record, and QC history. The consumed quantity reduces this source lot’s remaining stock; the output quantity becomes the new lot’s stock and can be lower if coloring causes process loss. The new lot is linked back to this source, and its identifier is generated from the source lot and color.
            </p>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Creating lot...' : 'Create colored lot'} <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
