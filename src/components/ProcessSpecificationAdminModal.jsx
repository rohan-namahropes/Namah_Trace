import React, { useState } from 'react'
import { AlertCircle, FileUp, Trash2, X } from 'lucide-react'

export function ProcessSpecificationAdminModal({
  specifications = [],
  error: loadError = '',
  onSave,
  onDelete,
  onClose,
}) {
  const [processFamily, setProcessFamily] = useState('')
  const [typeName, setTypeName] = useState('')
  const [file, setFile] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const resetForm = () => {
    setProcessFamily('')
    setTypeName('')
    setFile(null)
    setEditingId(null)
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setProcessFamily(item.process_family)
    setTypeName(item.type_name)
    setFile(null)
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    setBusy(true)
    const result = await onSave({
      id: editingId,
      processFamily,
      typeName,
      file,
    })
    if (result?.error) {
      setError(result.error.message || 'Unable to save process specification.')
      setBusy(false)
      return
    }
    resetForm()
    setBusy(false)
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.process_family} · ${item.type_name} specification?`)) return
    setError('')
    const result = await onDelete(item.id)
    if (result?.error) setError(result.error.message || 'Unable to delete process specification.')
    if (editingId === item.id && !result?.error) resetForm()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <div>
            <h2>Process Type Specifications</h2>
            <p className="modal-subtitle">Create open-ended process types and upload their specifications.</p>
          </div>
          <button className="icon-button modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {(error || loadError) && (
          <div className="modal-error-alert" role="alert">
            <AlertCircle size={16} />
            <span>{error || loadError}</span>
          </div>
        )}

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <label className="form-field">
              <span>Process family *</span>
              <input
                required
                value={processFamily}
                onChange={(event) => setProcessFamily(event.target.value)}
                placeholder="e.g. Twisting"
              />
            </label>
            <label className="form-field">
              <span>Process type *</span>
              <input
                required
                value={typeName}
                onChange={(event) => setTypeName(event.target.value)}
                placeholder="e.g. Type 1, Type 2, Type 3..."
              />
            </label>
          </div>
          <label className="form-field">
            <span>Specification file (optional)</span>
            <input
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <small className="field-hint">PDF, DOCX, JPG, or PNG · maximum 25 MB. Upload now or add a file later.</small>
          </label>
          <div className="modal-actions">
            {editingId && (
              <button type="button" className="secondary-button" onClick={resetForm} disabled={busy}>
                Cancel edit
              </button>
            )}
            <button type="submit" className="primary-button" disabled={busy}>
              <FileUp size={15} /> {busy ? 'Saving...' : editingId ? 'Update type' : 'Add type'}
            </button>
          </div>
        </form>

        <section className="detail-lifecycle">
          <div className="detail-section-heading"><h2>Configured types</h2></div>
          {specifications.length ? (
            <div className="history-list">
              {specifications.map((item) => (
                <article className="history-row" key={item.id}>
                  <div>
                    <strong>{item.process_family} · {item.type_name}</strong>
                    <span>{item.specification_file_name || 'Specification file not uploaded yet'}</span>
                  </div>
                  <div className="detail-quick-actions">
                    <button type="button" className="text-action" onClick={() => handleEdit(item)}>Edit</button>
                    <button type="button" className="timeline-delete-action" onClick={() => handleDelete(item)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="detail-empty-state">No process types have been configured.</p>
          )}
        </section>
      </div>
    </div>
  )
}
