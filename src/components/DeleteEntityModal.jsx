import React, { useState } from 'react'
import { AlertCircle, Trash2, X } from 'lucide-react'

export function DeleteEntityModal({ entity, onClose, onDelete }) {
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const matchesBatchId = confirmation.trim() === entity.batch_id

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!matchesBatchId || busy) return

    setError('')
    setBusy(true)
    try {
      const result = await onDelete(entity.id)
      if (result?.error && !result.error.operationCommitted) throw result.error
      onClose()
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete this batch.')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-batch-heading">
        <div className="modal-head">
          <div>
            <h2 id="delete-batch-heading">Delete batch?</h2>
            <p className="modal-subtitle">This permanently removes the batch and its associated records.</p>
          </div>
          <button type="button" className="icon-button modal-close-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {error && <div className="modal-error-alert" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-info-callout amber">
            <strong>{entity.batch_id}</strong>
            <p>
              Batch data, tests, parameters, processes, genealogy links, and evidence records will be deleted.
              A batch that has downstream lots cannot be deleted until those child lots are removed first.
            </p>
            <p>Evidence files stored in Supabase Storage are also removed.</p>
          </div>
          <label className="form-field">
            <span>Type the batch ID to confirm</span>
            <input
              autoComplete="off"
              autoFocus
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={entity.batch_id}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary-button delete-entity-confirm" disabled={busy || !matchesBatchId}>
              <Trash2 size={16} /> {busy ? 'Deleting batch...' : 'Permanently delete'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
