import React, { useEffect, useState } from 'react'
import { AlertCircle, Check, X } from 'lucide-react'
import {
  getRoleAccessConfiguration,
  listUserProfiles,
  saveRoleAccessConfiguration,
  updateUserRole,
} from '../lib/api'

const permissionFields = [
  ['can_view', 'View batches and history'],
  ['can_produce', 'Create and allocate production lots'],
  ['can_edit', 'Edit batch details and status'],
  ['can_process', 'Record process events'],
  ['can_qc', 'Record QC tests, parameters, and evidence'],
  ['can_delete', 'Delete records'],
  ['can_manage_users', 'Assign user roles'],
]

const roleOptions = [
  ['operator', 'Production'],
  ['qc', 'Quality Control'],
  ['viewer', 'Read-only'],
  ['admin', 'Admin'],
]

export function AccessControlAdminModal({ onClose, currentUserId }) {
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([getRoleAccessConfiguration(), listUserProfiles()])
      .then(([roleResult, userResult]) => {
        if (!active) return
        if (roleResult.error) throw roleResult.error
        if (userResult.error) throw userResult.error
        setRoles(roleResult.data)
        setUsers(userResult.data)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load role access settings.')
      })
    return () => { active = false }
  }, [])

  const updatePermission = async (role, field, value) => {
    setError('')
    setBusy(true)
    const result = await saveRoleAccessConfiguration(role, { [field]: value })
    if (result.error) {
      setError(result.error.message || 'Unable to save the role permission.')
    } else {
      setRoles((current) => current.map((item) => item.role === role ? result.data : item))
    }
    setBusy(false)
  }

  const changeUserRole = async (userId, role) => {
    setError('')
    setBusy(true)
    const result = await updateUserRole(userId, role)
    if (result.error) {
      setError(result.error.message || 'Unable to update the user role.')
    } else {
      setUsers((current) => current.map((item) => item.id === userId ? result.data : item))
    }
    setBusy(false)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-dialog access-control-modal" role="dialog" aria-modal="true" aria-labelledby="access-heading">
        <div className="modal-head">
          <div>
            <h2 id="access-heading">Users & access matrix</h2>
            <p className="modal-subtitle">Role permissions are stored in the database and can be changed here.</p>
          </div>
          <button type="button" className="icon-button modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="modal-error-alert" role="alert">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
        )}

        <div className="detail-lifecycle">
          <h3>Assigned users</h3>
          {users.map((user) => (
            <label className="form-grid-2" key={user.id}>
              <span className="form-field">
                {user.display_name}{user.id === currentUserId ? ' (you)' : ''}
                {user.email && <small className="field-hint">{user.email}</small>}
              </span>
              <select
                className="input"
                value={user.role}
                disabled={busy || user.id === currentUserId}
                onChange={(event) => changeUserRole(user.id, event.target.value)}
              >
                {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ))}
          <p className="field-hint">New sign-ups remain Production by default. An Admin can assign other roles here.</p>
        </div>

        <div className="detail-lifecycle">
          <h3>Permission matrix</h3>
          <div className="access-matrix">
            <div className="access-matrix-row access-matrix-header">
              <strong>Permission</strong>
              {roles.map((role) => <strong key={role.role}>{role.display_name}</strong>)}
            </div>
            {permissionFields.map(([field, label]) => (
              <div className="access-matrix-row" key={field}>
                <span>{label}</span>
                {roles.map((role) => (
                  <label key={role.role} className="access-matrix-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(role[field])}
                      disabled={busy || role.role === 'admin'}
                      aria-label={`${label} for ${role.display_name}`}
                      onChange={(event) => updatePermission(role.role, field, event.target.checked)}
                    />
                    {role[field] && <Check size={14} aria-hidden="true" />}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <p className="field-hint">Admin permissions are fixed to full access to prevent accidental lockout.</p>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  )
}
