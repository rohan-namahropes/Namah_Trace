import React, { useState } from 'react'
import { X, Upload, AlertCircle, FileText, Check } from 'lucide-react'

export function UploadEvidenceModal({ entity, onClose, onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [processId, setProcessId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setError('Please select a file to upload.')
      return
    }

    setBusy(true)
    setError('')
    try {
      // Read data URL if image, or create mock object URL
      let fileDataUrl = null
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader()
        fileDataUrl = await new Promise((resolve) => {
          reader.onload = (ev) => resolve(ev.target.result)
          reader.readAsDataURL(selectedFile)
        })
      }

      await onUpload({
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        fileDataUrl: fileDataUrl || URL.createObjectURL(selectedFile),
        processId: processId || null,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to upload attachment')
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-head">
          <div>
            <h2>Attach Evidence / Document</h2>
            <p className="modal-subtitle">
              Upload Certificate of Analysis, laboratory curves, or inspection photos.
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
          {/* File Picker Box */}
          <div className="file-dropzone-box">
            <input
              type="file"
              id="evidence-file-input"
              className="dropzone-input"
              onChange={handleFileChange}
            />
            <label htmlFor="evidence-file-input" className="dropzone-label">
              <Upload size={28} className="dropzone-icon" />
              {selectedFile ? (
                <div className="dropzone-selected-file">
                  <strong>{selectedFile.name}</strong>
                  <span>{(selectedFile.size / 1024).toFixed(0)} KB</span>
                </div>
              ) : (
                <div className="dropzone-prompt">
                  <strong>Click to select file</strong>
                  <span>Supports PDF, JPG, PNG, DOCX up to 25MB</span>
                </div>
              )}
            </label>
          </div>

          {/* Optional process linkage */}
          {entity.processes && entity.processes.length > 0 && (
            <label className="form-field">
              <span>Link to Process (Optional)</span>
              <select value={processId} onChange={(e) => setProcessId(e.target.value)}>
                <option value="">-- General Batch Document (Not linked to specific step) --</option>
                {entity.processes.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.process_name} ({pr.specification || 'Process'})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy || !selectedFile}>
              {busy ? 'Uploading...' : 'Attach File to Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
