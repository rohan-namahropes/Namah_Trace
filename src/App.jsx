import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import {
  listEntities,
  getEntity,
  createFlatYarn,
  createYarnBatch,
  createRopeBatch,
  updateEntityBasicInfo,
  updateEntityStatus,
  addParameter,
  deleteParameter,
  addTest,
  deleteTest,
  addProcess,
  addEvidence,
  getGlobalAuditLogs,
  getStorageMode,
  checkSupabaseAvailable,
  resetWorkspaceToSeed,
} from './lib/api'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Dashboard } from './components/Dashboard'
import { EntityList } from './components/EntityList'
import { EntityDetail } from './components/EntityDetail'
import { AuditTrailView } from './components/AuditTrailView'
import { CreateEntityModal } from './components/CreateEntityModal'
import { EditBasicInfoModal } from './components/EditBasicInfoModal'
import { AddParameterModal } from './components/AddParameterModal'
import { AddTestModal } from './components/AddTestModal'
import { AddProcessModal } from './components/AddProcessModal'
import { UploadEvidenceModal } from './components/UploadEvidenceModal'
import { SqlMigrationModal } from './components/SqlMigrationModal'
import { Login } from './components/Login'

const DEMO_SESSION_KEY = 'namah_trace_demo_session'

export function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeView, setActiveView] = useState('dashboard') // 'dashboard' | 'flat_yarn' | 'yarn' | 'rope' | 'audit'
  const [selectedEntityId, setSelectedEntityId] = useState(null)
  const [selectedEntityData, setSelectedEntityData] = useState(null)
  const [entities, setEntities] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [storageMode, setStorageMode] = useState('local')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Modals state
  const [createModal, setCreateModal] = useState({ open: false, type: 'flat_yarn' })
  const [editBasicModalOpen, setEditBasicModalOpen] = useState(false)
  const [addParamModalOpen, setAddParamModalOpen] = useState(false)
  const [addTestModalOpen, setAddTestModalOpen] = useState(false)
  const [addProcessModalOpen, setAddProcessModalOpen] = useState(false)
  const [uploadEvidenceModalOpen, setUploadEvidenceModalOpen] = useState(false)
  const [sqlModalOpen, setSqlModalOpen] = useState(false)

  // 1. Check Auth & Session
  useEffect(() => {
    let mounted = true

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return
        if (data.session) {
          setSession(data.session)
        } else {
          // Check local demo session
          const savedDemo = localStorage.getItem(DEMO_SESSION_KEY)
          if (savedDemo) {
            try {
              setSession(JSON.parse(savedDemo))
            } catch {}
          }
        }
        setAuthLoading(false)
      })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (mounted) {
          if (nextSession) {
            setSession(nextSession)
          }
        }
      })

      return () => {
        mounted = false
        subscription.unsubscribe()
      }
    } else {
      // Offline/Local mode
      const savedDemo = localStorage.getItem(DEMO_SESSION_KEY)
      if (savedDemo) {
        try {
          setSession(JSON.parse(savedDemo))
        } catch {}
      }
      setAuthLoading(false)
    }
  }, [])

  // 2. Load Entities & Audit Logs
  const refreshData = useCallback(async () => {
    await checkSupabaseAvailable()
    setStorageMode(getStorageMode())

    const [entRes, auditRes] = await Promise.all([
      listEntities(),
      getGlobalAuditLogs(50),
    ])

    if (entRes.data) setEntities(entRes.data)
    if (auditRes) setAuditLogs(auditRes)

    // If an entity is currently selected, refresh its details
    if (selectedEntityId) {
      const detailRes = await getEntity(selectedEntityId)
      if (detailRes.data) setSelectedEntityData(detailRes.data)
    }
  }, [selectedEntityId])

  useEffect(() => {
    if (session) {
      refreshData()
    }
  }, [session, refreshData])

  // When selectedEntityId changes, fetch full detail
  useEffect(() => {
    if (!selectedEntityId) {
      setSelectedEntityData(null)
      return
    }
    let mounted = true
    getEntity(selectedEntityId).then((res) => {
      if (mounted && res.data) {
        setSelectedEntityData(res.data)
      }
    })
    return () => {
      mounted = false
    }
  }, [selectedEntityId])

  // Sign in / Sign out handlers
  const handleLogin = (newSession) => {
    setSession(newSession)
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(newSession))
  }

  const handleLogout = async () => {
    localStorage.removeItem(DEMO_SESSION_KEY)
    if (supabase) {
      await supabase.auth.signOut()
    }
    setSession(null)
    setSelectedEntityId(null)
  }

  // Navigation handlers
  const handleSelectEntity = (entityId) => {
    setSelectedEntityId(entityId)
  }

  const handleBackFromDetail = () => {
    setSelectedEntityId(null)
    setSelectedEntityData(null)
  }

  const handleNavigateView = (viewId) => {
    setSelectedEntityId(null)
    setSelectedEntityData(null)
    setActiveView(viewId)
  }

  // Create Handlers
  const handleCreateFlatYarn = async (params) => {
    const res = await createFlatYarn(params, session?.user)
    if (res.data) {
      await refreshData()
      setSelectedEntityId(res.data.id)
    }
    return res
  }

  const handleCreateYarnBatch = async (params) => {
    const res = await createYarnBatch(params, session?.user)
    if (res.data) {
      await refreshData()
      setSelectedEntityId(res.data.id)
    }
    return res
  }

  const handleCreateRopeBatch = async (params) => {
    const res = await createRopeBatch(params, session?.user)
    if (res.data) {
      await refreshData()
      setSelectedEntityId(res.data.id)
    }
    return res
  }

  // Edit Handlers
  const handleUpdateBasicInfo = async (updates) => {
    if (!selectedEntityId) return
    const res = await updateEntityBasicInfo(selectedEntityId, updates, session?.user)
    if (res.data) {
      await refreshData()
    }
    return res
  }

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedEntityId) return
    const res = await updateEntityStatus(selectedEntityId, newStatus, session?.user)
    if (res.data) {
      await refreshData()
    }
    return res
  }

  // Parameter Handlers
  const handleAddParameter = async (param) => {
    if (!selectedEntityId) return
    const res = await addParameter(selectedEntityId, param, session?.user)
    if (res.data) await refreshData()
    return res
  }

  const handleDeleteParameter = async (paramId, paramName) => {
    if (!selectedEntityId) return
    if (!window.confirm(`Remove parameter "${paramName}"?`)) return
    const res = await deleteParameter(selectedEntityId, paramId, session?.user)
    if (res.data) await refreshData()
    return res
  }

  // Test Handlers
  const handleAddTest = async (test) => {
    if (!selectedEntityId) return
    const res = await addTest(selectedEntityId, test, session?.user)
    if (res.data) await refreshData()
    return res
  }

  const handleDeleteTest = async (testId, testName) => {
    if (!selectedEntityId) return
    if (!window.confirm(`Delete test record "${testName}"?`)) return
    const res = await deleteTest(selectedEntityId, testId, session?.user)
    if (res.data) await refreshData()
    return res
  }

  // Process Handlers
  const handleAddProcess = async (proc) => {
    if (!selectedEntityId) return
    const res = await addProcess(selectedEntityId, proc, session?.user)
    if (res.data) await refreshData()
    return res
  }

  // Evidence Handlers
  const handleUploadEvidence = async (ev) => {
    if (!selectedEntityId) return
    const res = await addEvidence(selectedEntityId, ev, session?.user)
    if (res.data) await refreshData()
    return res
  }

  // Reset Demo Workspace Handler
  const handleResetSeed = () => {
    resetWorkspaceToSeed()
    refreshData()
    setSelectedEntityId(null)
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-panel">
          <p className="eyebrow">NAMAH ROPES / OPERATIONS</p>
          <p className="login-copy">Initializing operational trace workspace...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!session) {
    return <Login onLogin={handleLogin} error={loginError} setError={setLoginError} />
  }

  // Breadcrumbs calculation
  const getBreadcrumbs = () => {
    const crumbs = [{ label: 'Traceability', onClick: () => handleNavigateView('dashboard') }]

    if (selectedEntityData) {
      let viewLabel = 'Batches'
      if (selectedEntityData.type === 'flat_yarn') viewLabel = 'Flat Yarn'
      if (selectedEntityData.type === 'yarn') viewLabel = 'Yarn Batches'
      if (selectedEntityData.type === 'rope') viewLabel = 'Rope Batches'

      crumbs.push({
        label: viewLabel,
        onClick: () => handleNavigateView(selectedEntityData.type),
      })
      crumbs.push({ label: `Batch ${selectedEntityData.batch_id}` })
    } else {
      if (activeView === 'dashboard') crumbs.push({ label: 'Overview' })
      if (activeView === 'flat_yarn') crumbs.push({ label: 'Flat Yarn Batches' })
      if (activeView === 'yarn') crumbs.push({ label: 'Yarn Batches' })
      if (activeView === 'rope') crumbs.push({ label: 'Rope Batches' })
      if (activeView === 'audit') crumbs.push({ label: 'Audit Trail' })
    }

    return crumbs
  }

  const counts = {
    flat_yarn: entities.filter((e) => e.type === 'flat_yarn').length,
    yarn: entities.filter((e) => e.type === 'yarn').length,
    rope: entities.filter((e) => e.type === 'rope').length,
    audit: auditLogs.length,
  }

  const availableFlatYarns = entities.filter((e) => e.type === 'flat_yarn')
  const availableYarns = entities.filter((e) => e.type === 'yarn')

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={selectedEntityData ? selectedEntityData.type : activeView}
        setActiveView={handleNavigateView}
        counts={counts}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onLogout={handleLogout}
        user={session.user}
        storageMode={storageMode}
        onOpenSqlModal={() => setSqlModalOpen(true)}
        onResetSeed={handleResetSeed}
      />

      <div className="main-layout-wrap">
        {/* Topbar */}
        <Topbar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          breadcrumbs={getBreadcrumbs()}
          onSelectEntity={handleSelectEntity}
          onOpenCreateModal={(tier) => setCreateModal({ open: true, type: tier || 'flat_yarn' })}
          storageMode={storageMode}
          user={session.user}
        />

        {/* Main Content Area */}
        <main className="main-scroll-content">
          {selectedEntityData ? (
            <EntityDetail
              entity={selectedEntityData}
              onBack={handleBackFromDetail}
              onNavigateEntity={handleSelectEntity}
              onOpenEditModal={() => setEditBasicModalOpen(true)}
              onOpenAddParamModal={() => setAddParamModalOpen(true)}
              onOpenAddTestModal={() => setAddTestModalOpen(true)}
              onOpenAddProcessModal={() => setAddProcessModalOpen(true)}
              onOpenUploadEvidenceModal={() => setUploadEvidenceModalOpen(true)}
              onDeleteParam={handleDeleteParameter}
              onDeleteTest={handleDeleteTest}
              onUpdateStatus={handleUpdateStatus}
            />
          ) : (
            <>
              {activeView === 'dashboard' && (
                <Dashboard
                  entities={entities}
                  auditLogs={auditLogs}
                  onSelectEntity={handleSelectEntity}
                  onOpenCreateModal={(tier) => setCreateModal({ open: true, type: tier })}
                  onNavigateView={handleNavigateView}
                />
              )}

              {(activeView === 'flat_yarn' || activeView === 'yarn' || activeView === 'rope') && (
                <EntityList
                  type={activeView}
                  entities={entities}
                  onSelectEntity={handleSelectEntity}
                  onOpenCreateModal={(tier) => setCreateModal({ open: true, type: tier })}
                />
              )}

              {activeView === 'audit' && (
                <AuditTrailView
                  auditLogs={auditLogs}
                  onSelectEntity={handleSelectEntity}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* MODALS */}
      {createModal.open && (
        <CreateEntityModal
          initialType={createModal.type}
          availableFlatYarns={availableFlatYarns}
          availableYarns={availableYarns}
          onClose={() => setCreateModal({ open: false, type: 'flat_yarn' })}
          onCreateFlatYarn={handleCreateFlatYarn}
          onCreateYarnBatch={handleCreateYarnBatch}
          onCreateRopeBatch={handleCreateRopeBatch}
        />
      )}

      {editBasicModalOpen && selectedEntityData && (
        <EditBasicInfoModal
          entity={selectedEntityData}
          onClose={() => setEditBasicModalOpen(false)}
          onSave={handleUpdateBasicInfo}
        />
      )}

      {addParamModalOpen && selectedEntityData && (
        <AddParameterModal
          onClose={() => setAddParamModalOpen(false)}
          onSave={handleAddParameter}
        />
      )}

      {addTestModalOpen && selectedEntityData && (
        <AddTestModal
          onClose={() => setAddTestModalOpen(false)}
          onSave={handleAddTest}
        />
      )}

      {addProcessModalOpen && selectedEntityData && (
        <AddProcessModal
          onClose={() => setAddProcessModalOpen(false)}
          onSave={handleAddProcess}
        />
      )}

      {uploadEvidenceModalOpen && selectedEntityData && (
        <UploadEvidenceModal
          entity={selectedEntityData}
          onClose={() => setUploadEvidenceModalOpen(false)}
          onUpload={handleUploadEvidence}
        />
      )}

      {sqlModalOpen && (
        <SqlMigrationModal onClose={() => setSqlModalOpen(false)} />
      )}
    </div>
  )
}
