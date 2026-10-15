import React, { useState } from 'react'
import { X, Upload, AlertCircle } from 'lucide-react'
import { EVIDENCE_ACCEPT, getEvidenceFileError } from './EvidenceFileInput'

export function UploadEvidenceModal({ entity, initialTarget = null, onClose, onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [recordTarget, setRecordTarget] = useState(
    initialTarget ? `${initialTarget.type}:${initialTarget.id}` : 'batch:'
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const fileError = getEvidenceFileError(file)
      if (fileError) {
        setSelectedFile(null)
        setError(fileError)
        return
      }
      setSelectedFile(file)
      setError('')
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
    const [targetType, targetId] = recordTarget.split(':')
    try {
      const result = await onUpload({
        file: selectedFile,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        processId: targetType === 'process' ? targetId : null,
        parameterId: targetType === 'parameter' ? targetId : null,
        testId: targetType === 'test' ? targetId : null,
      })
      if (result?.error) throw result.error
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
              accept={EVIDENCE_ACCEPT}
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
                  <span>Supports PDF, JPG, PNG, DOCX, MP4, MOV, WebM up to 25MB</span>
                </div>
              )}
            </label>
          </div>

          <label className="form-field">
            <span>Attach to record</span>
            <select value={recordTarget} onChange={(e) => setRecordTarget(e.target.value)}>
              <option value="batch:">Batch-level document</option>
              {(entity.processes || []).map((process) => (
                <option key={`process:${process.id}`} value={`process:${process.id}`}>
                  Process · {process.process_name}
                </option>
              ))}
              {(entity.parameters || []).map((parameter) => (
                <option key={`parameter:${parameter.id}`} value={`parameter:${parameter.id}`}>
                  Parameter · {parameter.name} ({parameter.value}{parameter.unit ? ` ${parameter.unit}` : ''})
                </option>
              ))}
              {(entity.tests || []).map((test) => (
                <option key={`test:${test.id}`} value={`test:${test.id}`}>
                  Test · {test.test_name} ({test.value}{test.unit ? ` ${test.unit}` : ''})
                </option>
              ))}
            </select>
          </label>

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
