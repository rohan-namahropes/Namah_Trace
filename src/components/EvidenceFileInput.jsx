import React from 'react'
import { Upload } from 'lucide-react'

export const EVIDENCE_ACCEPT = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.docx',
  '.mp4',
  '.mov',
  '.webm',
].join(',')

const MIME_BY_EXTENSION = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

export function getEvidenceFileError(file) {
  if (file.size > 25 * 1024 * 1024) return 'Evidence files must be 25 MB or smaller.'
  const extension = String(file.name || '').split('.').pop().toLowerCase()
  const expectedMime = MIME_BY_EXTENSION[extension]
  if (
    !expectedMime
    || (file.type && file.type !== expectedMime && file.type !== 'application/octet-stream')
  ) {
    return 'Supported evidence types are PDF, JPG, PNG, DOCX, MP4, MOV, and WebM.'
  }
  return null
}

export function EvidenceFileInput({ file, onChange, id = 'record-evidence-file' }) {
  return (
    <label className="form-field inline-evidence-field" htmlFor={id}>
      <span>Evidence file (Optional)</span>
      <span className="inline-evidence-picker">
        <Upload size={15} />
        <span>{file ? file.name : 'Choose a file'}</span>
      </span>
      <input
        id={id}
        className="inline-evidence-input"
        type="file"
        accept={EVIDENCE_ACCEPT}
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <small className="field-hint">PDF, JPG, PNG, DOCX, MP4, MOV, or WebM · up to 25 MB</small>
    </label>
  )
}
