import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowLeft, ArrowUpRight, BarChart3, Bell, BookOpen, Check, ChevronDown, CircleHelp,
  Clock3, Download, FileText, Filter, FlaskConical, Layers3, LogOut, Menu, MoreHorizontal,
  Paperclip, Plus, Search, Settings2, ShieldCheck, Upload, UserRound, X
} from 'lucide-react'
import './style.css'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { listBatches, uploadEvidence } from './lib/api'

const defaultStages = [
  { id: 'yarn-testing', name: 'Initial Yarn Testing', short: 'Yarn testing', color: '#e39b57' },
  { id: 'twisting', name: 'Twisting', short: 'Twisting', color: '#e39b57' },
  { id: 'dyeing', name: 'Dyeing', short: 'Dyeing', color: '#85a98a' },
  { id: 'braiding', name: 'Braiding', short: 'Braiding', color: '#85a98a' },
  { id: 'rope-testing', name: 'Rope Testing', short: 'Rope testing', color: '#779bb5' },
  { id: 'packaging', name: 'Packaging', short: 'Packaging', color: '#c5c8cb' },
]

const seedBatches = [
  { id: 'NL-2026-08-20', notes: 'Production run for 16mm braided rope.', created: '2026-08-20T08:42:00', status: 'In Progress', currentStage: 3, stages: [
    { ...defaultStages[0], status: 'Completed', performedBy: 'Rohan Mehta', completedAt: '2026-08-20T09:18:00', notes: 'Yarn cleared for production.', measurements: [{ key: 'BS', value: '25 kN' }, { key: 'Elongation', value: '4%' }] },
    { ...defaultStages[1], status: 'Completed', performedBy: 'Arjun S.', completedAt: '2026-08-20T11:26:00', notes: 'Twist consistency checked across sample.', measurements: [{ key: 'TPM', value: '12' }] },
    { ...defaultStages[2], status: 'In Progress', performedBy: 'Priya K.', startedAt: '2026-08-20T13:10:00', notes: 'Colour matching in progress.', measurements: [] },
    { ...defaultStages[3], status: 'Pending', measurements: [] },
    { ...defaultStages[4], status: 'Pending', measurements: [] },
    { ...defaultStages[5], status: 'Pending', measurements: [] },
  ] },
  { id: 'BATCH-001', notes: 'Black polypropylene rope sample.', created: '2026-08-19T10:16:00', status: 'Completed', currentStage: 6, stages: defaultStages.map((stage, index) => ({ ...stage, status: 'Completed', performedBy: index % 2 ? 'Arjun S.' : 'Rohan Mehta', completedAt: `2026-08-${19 - Math.min(index, 3)}T${10 + index}:20:00`, notes: index === 0 ? 'All initial samples within expected range.' : 'Stage completed and recorded.', measurements: index === 0 ? [{ key: 'BS', value: '27 kN' }] : [] })) },
  { id: 'XYZ-23', notes: 'Awaiting incoming material confirmation.', created: '2026-08-18T15:03:00', status: 'On Hold', currentStage: 1, stages: defaultStages.map((stage, index) => ({ ...stage, status: index === 0 ? 'On Hold' : 'Pending', measurements: [] })) },
]

const formatDate = (date) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
const formatTime = (date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
const getProgress = (batch) => Math.round((batch.stages.filter((stage) => stage.status === 'Completed').length / batch.stages.length) * 100)

function App() {
  const [session, setSession] = useState(null)
  const [batches, setBatches] = useState(seedBatches)
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const [selectedStageId, setSelectedStageId] = useState(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured || !session) return
    listBatches().then(({ data }) => {
      if (!data) return
      setBatches(data.map((batch) => ({
        id: batch.id,
        notes: batch.notes || '',
        created: batch.created_at,
        status: batch.status,
        currentStage: (batch.batch_stages || []).filter((stage) => stage.status === 'Completed').length,
        stages: (batch.batch_stages || []).sort((a, b) => (a.workflow_stages?.position || 0) - (b.workflow_stages?.position || 0)).map((stage) => ({
          id: stage.workflow_stages?.id || stage.stage_id,
          name: stage.workflow_stages?.name || 'Unnamed stage',
          short: stage.workflow_stages?.name || 'Stage',
          color: '#85a98a',
          status: stage.status,
          performedBy: stage.performed_by || '',
          startedAt: stage.started_at,
          completedAt: stage.completed_at,
          notes: stage.notes || '',
          measurements: (stage.stage_measurements || []).map((measurement) => ({ key: measurement.field_name, value: measurement.field_value })),
        })),
      })))
    })
  }, [session])

  if (!session) return <Login onLogin={setSession} error={loginError} setError={setLoginError} />

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId)
  const selectedStage = selectedBatch?.stages.find((stage) => stage.id === selectedStageId)

  const addBatch = (batch) => {
    setBatches((current) => [batch, ...current])
    setShowCreate(false)
    setSelectedBatchId(batch.id)
  }

  const updateStage = async (stageId, updates) => {
    if (isSupabaseConfigured && updates.evidenceFiles?.length) {
      await Promise.all(updates.evidenceFiles.map((file) => uploadEvidence(file, selectedBatch.id, stageId, session.user.id)))
    }
    setBatches((current) => current.map((batch) => batch.id === selectedBatch.id ? {
      ...batch,
      stages: batch.stages.map((stage) => stage.id === stageId ? { ...stage, ...updates } : stage),
      currentStage: updates.status === 'Completed' ? Math.max(batch.currentStage, batch.stages.findIndex((stage) => stage.id === stageId) + 1) : batch.currentStage,
      status: updates.status === 'On Hold' ? 'On Hold' : batch.status,
    } : batch))
    setSelectedStageId(null)
  }

  return <div className="app-shell">
    <Sidebar active={selectedBatch ? 'Batches' : 'Overview'} mobileOpen={showMobileNav} onClose={() => setShowMobileNav(false)} onLogout={() => setSession(null)} />
    <main className="main-content">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setShowMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{selectedBatch ? selectedBatch.id : 'Overview'}</strong></div>
        <div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><div className="avatar">RM</div></div>
      </header>
      {selectedBatch ? <BatchView batch={selectedBatch} onBack={() => setSelectedBatchId(null)} onStageClick={setSelectedStageId} onDownload={() => downloadReport(selectedBatch)} /> : <Dashboard batches={batches} search={search} setSearch={setSearch} onCreate={() => setShowCreate(true)} onSelect={setSelectedBatchId} />}
    </main>
    {showCreate && <CreateBatch onClose={() => setShowCreate(false)} onCreate={addBatch} />}
    {selectedStage && <StageDetail stage={selectedStage} batch={selectedBatch} onClose={() => setSelectedStageId(null)} onSave={updateStage} />}
  </div>
}

function Login({ onLogin, error, setError }) {
  const [email, setEmail] = useState('rohan.namahropes@gmail.com')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('')
    if (isSupabaseConfigured) {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) setError(authError.message)
      else onLogin(data.session)
    } else {
      setTimeout(() => onLogin({ user: { email } }), 300)
    }
    setBusy(false)
  }
  return <div className="login-page"><div className="login-panel"><div className="brand-mark large">N</div><p className="eyebrow">NAMAH ROPES / OPERATIONS</p><h1>Welcome to<br /><em>Namah Trace.</em></h1><p className="login-copy">From yarn to rope. Every step accounted for.</p><form onSubmit={submit} className="login-form"><label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label><label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required={!isSupabaseConfigured} placeholder={isSupabaseConfigured ? 'Enter your password' : 'Demo mode enabled'} /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'} <ArrowUpRight size={17} /></button></form><p className="login-foot"><ShieldCheck size={14} /> Internal workspace · Administrator access only</p></div><div className="login-aside"><div className="rope-lines"></div><p>TRACE / 01</p><strong>One identity.<br />Every process.</strong></div></div>
}

function Sidebar({ active, mobileOpen, onClose, onLogout }) { return <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="side-top"><div className="brand"><span className="brand-mark">N</span><span>Namah <b>Trace</b></span></div><button className="icon-button side-close" onClick={onClose}><X size={19} /></button></div><div className="workspace-switcher"><span className="workspace-dot"></span><div><small>WORKSPACE</small><strong>Namah Ropes</strong></div><ChevronDown size={15} /></div><nav><p className="nav-label">Workspace</p><button className={active === 'Overview' ? 'active' : ''} onClick={onClose}><BarChart3 size={17} /> Overview</button><button className={active === 'Batches' ? 'active' : ''} onClick={onClose}><Layers3 size={17} /> All batches <span className="nav-count">3</span></button><button onClick={onClose}><BookOpen size={17} /> Documentation</button><p className="nav-label second">Manage</p><button onClick={onClose}><Settings2 size={17} /> Settings</button></nav><div className="side-bottom"><div className="profile"><div className="avatar">RM</div><div><strong>Rohan Mehta</strong><small>Administrator</small></div><MoreHorizontal size={17} /></div><button className="logout-button" onClick={onLogout}><LogOut size={16} /> Sign out</button></div></aside> }

function Dashboard({ batches, search, setSearch, onCreate, onSelect }) { const filtered = batches.filter((batch) => batch.id.toLowerCase().includes(search.toLowerCase()) || batch.notes.toLowerCase().includes(search.toLowerCase())); return <section className="page dashboard-page"><div className="page-heading"><div><p className="eyebrow">WORKSPACE / OVERVIEW</p><h1>Good morning, Rohan <span>↗</span></h1><p className="subheading">Keep an eye on every batch moving through production.</p></div><button className="primary-button" onClick={onCreate}><Plus size={17} /> Create new batch</button></div><div className="stat-grid"><Stat label="Active batches" value={batches.filter((batch) => batch.status === 'In Progress').length.toString().padStart(2, '0')} detail="Currently in production" icon={<FlaskConical size={19} />} /><Stat label="Completed this month" value="01" detail="Since 01 Aug 2026" icon={<Check size={19} />} /><Stat label="On hold" value={batches.filter((batch) => batch.status === 'On Hold').length.toString().padStart(2, '0')} detail="Requires attention" icon={<Clock3 size={19} />} /></div><div className="section-heading"><div><h2>All batches</h2><p>{batches.length} batch records in your workspace</p></div><div className="table-tools"><div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search batches" /></div><button className="secondary-button icon-text"><Filter size={16} /> Filter</button></div></div><div className="batch-table"><div className="table-head"><span>Batch name / ID</span><span>Current stage</span><span>Progress</span><span>Status</span><span>Created</span><span></span></div>{filtered.map((batch) => <BatchRow key={batch.id} batch={batch} onClick={() => onSelect(batch.id)} />)}{filtered.length === 0 && <div className="empty-state">No batches match “{search}”.</div>}</div></section> }
function Stat({ label, value, detail, icon }) { return <div className="stat"><div className="stat-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></div> }
function BatchRow({ batch, onClick }) { const progress = getProgress(batch); return <button className="batch-row" onClick={onClick}><div className="batch-name"><span className="batch-symbol">{batch.id.slice(0, 1)}</span><div><strong>{batch.id}</strong><small>{batch.notes}</small></div></div><div className="stage-cell"><span className="stage-dot" style={{ background: batch.stages[Math.max(0, batch.currentStage - 1)]?.color }}></span>{batch.currentStage >= 6 ? 'Packaging' : batch.stages[batch.currentStage - 1]?.name || 'Not started'}</div><div className="progress-cell"><div className="progress-bar"><span style={{ width: `${progress}%` }}></span></div><small>{progress}%</small></div><div><Status status={batch.status} /></div><div className="date-cell">{formatDate(batch.created)}<small>{formatTime(batch.created)}</small></div><ArrowUpRight size={17} className="row-arrow" /></button> }
function Status({ status }) { return <span className={`status status-${status.toLowerCase().replace(' ', '-')}`}><i></i>{status}</span> }

function BatchView({ batch, onBack, onStageClick, onDownload }) { const progress = getProgress(batch); const history = batch.stages.filter((stage) => stage.status !== 'Pending').flatMap((stage) => [{ stage: stage.name, action: stage.status === 'Completed' ? 'Stage completed' : 'Stage started', person: stage.performedBy || 'Unassigned', date: stage.completedAt || stage.startedAt || batch.created, status: stage.status, notes: stage.notes }]).reverse(); return <section className="page batch-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> All batches</button><div className="batch-title-row"><div><p className="eyebrow">BATCH RECORD</p><h1>{batch.id}</h1><p className="subheading">Created {formatDate(batch.created)} at {formatTime(batch.created)} · by Rohan Mehta</p></div><div className="batch-actions"><Status status={batch.status} /><button className="secondary-button" onClick={onDownload}><Download size={16} /> Download report</button></div></div><div className="batch-overview"><div><p className="eyebrow">CURRENT PROGRESS</p><div className="big-progress"><strong>{progress}%</strong><div className="progress-bar"><span style={{ width: `${progress}%` }}></span></div></div><p className="progress-caption">{batch.stages.filter((stage) => stage.status === 'Completed').length} of {batch.stages.length} stages completed</p></div><div className="batch-note"><Paperclip size={17} /><div><small>BATCH NOTES</small><p>{batch.notes || 'No notes added to this batch.'}</p></div></div></div><div className="pipeline-section"><div className="section-heading"><div><h2>Manufacturing pipeline</h2><p>Click any stage to view or update its record.</p></div><button className="icon-button" aria-label="Pipeline options"><MoreHorizontal size={19} /></button></div><div className="pipeline">{batch.stages.map((stage, index) => <button className={`pipeline-stage stage-${stage.status.toLowerCase().replace(' ', '-')}`} key={stage.id} onClick={() => onStageClick(stage.id)}><div className="stage-number">{stage.status === 'Completed' ? <Check size={15} /> : String(index + 1).padStart(2, '0')}</div><span className="pipeline-line"></span><div className="pipeline-copy"><strong>{stage.name}</strong><span>{stage.status === 'Completed' ? `Completed ${formatDate(stage.completedAt)}` : stage.status === 'In Progress' ? 'In progress now' : stage.status}</span></div></button>)}</div></div><div className="history-section"><div className="section-heading"><div><h2>Batch history</h2><p>A complete record of actions taken on this batch.</p></div><button className="secondary-button icon-text"><Filter size={16} /> Filter history</button></div><div className="timeline">{history.map((entry, index) => <div className="timeline-item" key={`${entry.date}-${index}`}><div className="timeline-marker"><span></span></div><div className="timeline-content"><div className="timeline-top"><strong>{entry.stage}</strong><Status status={entry.status} /><time>{formatDate(entry.date)} · {formatTime(entry.date)}</time></div><p>{entry.action} by <b>{entry.person}</b>{entry.notes ? ` — ${entry.notes}` : ''}</p></div></div>)}{history.length === 0 && <div className="empty-state">No history has been recorded yet.</div>}</div></div></section> }

function CreateBatch({ onClose, onCreate }) { const [id, setId] = useState(''); const [notes, setNotes] = useState(''); const submit = (event) => { event.preventDefault(); const created = new Date().toISOString(); onCreate({ id: id.trim(), notes, created, status: 'In Progress', currentStage: 1, stages: defaultStages.map((stage, index) => ({ ...stage, status: index === 0 ? 'In Progress' : 'Pending', measurements: [] })) }) }; return <div className="modal-backdrop"><form className="modal create-modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">NEW RECORD</p><h2>Create new batch</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div><p className="modal-intro">Give this production run a unique identity. You can add to its record as it moves through the pipeline.</p><label>Batch name / ID <input value={id} onChange={(event) => setId(event.target.value)} placeholder="e.g. NL-2026-08-21" required autoFocus /></label><label>Notes <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What is this batch for?" rows="4" /></label><label>Attachment <div className="upload-box"><Upload size={18} /><span>Drop a file here or <b>browse</b><small>Photos or documents, up to 10MB</small></span><input type="file" /></div></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Create batch <ArrowUpRight size={16} /></button></div></form></div> }

function StageDetail({ stage, batch, onClose, onSave }) { const [status, setStatus] = useState(stage.status); const [person, setPerson] = useState(stage.performedBy || 'Rohan Mehta'); const [notes, setNotes] = useState(stage.notes || ''); const [measurements, setMeasurements] = useState(stage.measurements || []); const [files, setFiles] = useState([]); const [newKey, setNewKey] = useState(''); const [newValue, setNewValue] = useState(''); const addMeasurement = () => { if (newKey && newValue) { setMeasurements([...measurements, { key: newKey, value: newValue }]); setNewKey(''); setNewValue('') } }; return <div className="modal-backdrop"><div className="modal stage-modal"><div className="modal-head"><div className="stage-modal-title"><span className="stage-number">{stage.status === 'Completed' ? <Check size={15} /> : '03'}</span><div><p className="eyebrow">STAGE RECORD</p><h2>{stage.name}</h2></div></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="stage-status-tabs">{['Pending', 'In Progress', 'Completed', 'On Hold'].map((option) => <button key={option} className={status === option ? 'selected' : ''} onClick={() => setStatus(option)}>{option}</button>)}</div><div className="form-grid"><label>Person responsible<div className="input-with-icon"><UserRound size={16} /><input value={person} onChange={(event) => setPerson(event.target.value)} /></div></label><label>Date & time<div className="input-with-icon"><Clock3 size={16} /><input value={formatDate(new Date())} readOnly /></div></label></div><label>Notes / remarks<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="3" placeholder="Record what happened in this stage..." /></label><div className="measurements"><div className="subsection-title"><div><h3>Measurements</h3><p>Flexible key-value fields for this stage.</p></div><FlaskConical size={18} /></div><div className="measurement-list">{measurements.map((measurement, index) => <div className="measurement-row" key={`${measurement.key}-${index}`}><span>{measurement.key}</span><b>{measurement.value}</b><button onClick={() => setMeasurements(measurements.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></div>)}</div><div className="measurement-add"><input value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="Field name" /><input value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder="Value" /><button type="button" className="secondary-button" onClick={addMeasurement}><Plus size={15} /> Add</button></div></div><label>Evidence<div className="upload-box compact"><Upload size={18} /><span>{files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Upload photos or documents'}<small>Files will be stored with this stage record</small></span><input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></div></label><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={() => onSave(stage.id, { status, performedBy: person, notes, measurements, evidenceFiles: files, completedAt: status === 'Completed' ? new Date().toISOString() : stage.completedAt, startedAt: status === 'In Progress' ? new Date().toISOString() : stage.startedAt })}>Save stage record <Check size={16} /></button></div></div></div> }

function downloadReport(batch) { const rows = batch.stages.map((stage) => `<tr><td>${stage.name}</td><td>${stage.status}</td><td>${stage.performedBy || '—'}</td><td>${stage.completedAt ? formatDate(stage.completedAt) : '—'}</td><td>${(stage.measurements || []).map((measurement) => `${measurement.key}: ${measurement.value}`).join('<br>') || '—'}</td><td>${stage.notes || '—'}</td></tr>`).join(''); const html = `<html><head><title>Namah Trace · ${batch.id}</title><style>body{font:14px Arial;color:#202824;padding:40px}h1{font:700 30px Georgia}p{color:#68736e}table{border-collapse:collapse;width:100%;margin-top:28px}th,td{border:1px solid #d9dedb;padding:10px;text-align:left;vertical-align:top}th{background:#eef2ef;font-size:11px;text-transform:uppercase;letter-spacing:1px}</style></head><body><p>NAMAH ROPES / NAMAH TRACE</p><h1>Batch report: ${batch.id}</h1><p>${batch.notes || ''}</p><p>Created ${formatDate(batch.created)} · Status ${batch.status} · Progress ${getProgress(batch)}%</p><table><thead><tr><th>Stage</th><th>Status</th><th>Person</th><th>Date</th><th>Measurements</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`; const report = window.open('', '_blank'); report.document.write(html); report.document.close() }

export default App

createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
