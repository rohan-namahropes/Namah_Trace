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
  getCurrentUserProfile,
  getStorageMode,
  checkSupabaseAvailable,
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

export function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeView, setActiveView] = useState('dashboard') // 'dashboard' | 'flat_yarn' | 'yarn' | 'rope' | 'audit'
  const [selectedEntityId, setSelectedEntityId] = useState(null)
  const [selectedEntityData, setSelectedEntityData] = useState(null)
  const [entities, setEntities] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [userProfile, setUserProfile] = useState(null)
  const [storageMode, setStorageMode] = useState('unavailable')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [dataError, setDataError] = useState('')

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
      supabase.auth.getSession().then(({ data, error }) => {
        if (!mounted) return
        if (error) setLoginError(error.message)
        setSession(data.session)
        setAuthLoading(false)
      }).catch((error) => {
        if (!mounted) return
        setLoginError(error.message || 'Failed to restore the Supabase session.')
        setAuthLoading(false)
      })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (mounted) {
          setSession(nextSession)
        }
      })

      return () => {
        mounted = false
        subscription.unsubscribe()
      }
    } else {
      setAuthLoading(false)
    }
  }, [])

  // 2. Load Entities & Audit Logs
  const refreshData = useCallback(async () => {
    try {
      if (!session?.user?.id) return
      await checkSupabaseAvailable()
      setStorageMode(getStorageMode())

      const [entRes, auditRes, profileRes] = await Promise.all([
        listEntities(),
        getGlobalAuditLogs(50),
        getCurrentUserProfile(session.user.id),
      ])
      if (entRes.error) throw entRes.error
      if (profileRes.error) throw profileRes.error

      setEntities(entRes.data)
      setAuditLogs(auditRes)
      setUserProfile(profileRes.data)

      if (selectedEntityId) {
        const detailRes = await getEntity(selectedEntityId)
        if (detailRes.error) throw detailRes.error
        setSelectedEntityData(detailRes.data)
      }
      setDataError('')
    } catch (error) {
      setStorageMode('unavailable')
      setEntities([])
      setAuditLogs([])
      setSelectedEntityData(null)
      setDataError(error.message || 'Unable to load production data from Supabase.')
    }
  }, [selectedEntityId, session?.user?.id])

  useEffect(() => {
    setUserProfile(null)
    setEntities([])
    setAuditLogs([])
    setSelectedEntityData(null)
    setDataError('')
  }, [session?.user?.id])

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
      if (!mounted) return
      if (res.error) {
        setDataError(res.error.message)
        return
      }
      setSelectedEntityData(res.data)
      setDataError('')
    })
    return () => {
      mounted = false
    }
  }, [selectedEntityId])

  // Sign in / Sign out handlers
  const handleLogin = (newSession) => {
    setSession(newSession)
  }

  const handleLogout = async () => {
    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      } catch (error) {
        setDataError(`Unable to sign out: ${error.message || 'Supabase sign-out failed.'}`)
        return
      }
    }
    setSession(null)
    setUserProfile(null)
    setSelectedEntityId(null)
  }

  const finishMutation = async (result) => {
    if (result.data || result.error?.operationCommitted) {
      await refreshData()
    }
    if (result.error) setDataError(result.error.message)
    return result
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
    const res = await createFlatYarn(params)
    if (res.data) setSelectedEntityId(res.data.id)
    return finishMutation(res)
  }

  const handleCreateYarnBatch = async (params) => {
    const res = await createYarnBatch(params)
    if (res.data) setSelectedEntityId(res.data.id)
    return finishMutation(res)
  }

  const handleCreateRopeBatch = async (params) => {
    const res = await createRopeBatch(params)
    if (res.data) setSelectedEntityId(res.data.id)
    return finishMutation(res)
  }

  // Edit Handlers
  const handleUpdateBasicInfo = async (updates) => {
    if (!selectedEntityId) return
    return finishMutation(await updateEntityBasicInfo(selectedEntityId, updates))
  }

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedEntityId) return
    return finishMutation(await updateEntityStatus(selectedEntityId, newStatus))
  }

  // Parameter Handlers
  const handleAddParameter = async (param) => {
    if (!selectedEntityId) return
    return finishMutation(await addParameter(selectedEntityId, param))
  }

  const handleDeleteParameter = async (paramId, paramName) => {
    if (!selectedEntityId) return
    if (!window.confirm(`Remove parameter "${paramName}"?`)) return
    return finishMutation(await deleteParameter(selectedEntityId, paramId))
  }

  // Test Handlers
  const handleAddTest = async (test) => {
    if (!selectedEntityId) return
    return finishMutation(await addTest(selectedEntityId, test))
  }

  const handleDeleteTest = async (testId, testName) => {
    if (!selectedEntityId) return
    if (!window.confirm(`Delete test record "${testName}"?`)) return
    return finishMutation(await deleteTest(selectedEntityId, testId))
  }

  // Process Handlers
  const handleAddProcess = async (proc) => {
    if (!selectedEntityId) return
    return finishMutation(await addProcess(selectedEntityId, proc))
  }

  // Evidence Handlers
  const handleUploadEvidence = async (ev) => {
    if (!selectedEntityId) return
    return finishMutation(await addEvidence(selectedEntityId, ev))
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-panel">
          <p className="eyebrow">NAMAH TRACE · V1.1</p>
          <p className="login-copy">Initializing operational trace workspace...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!session) {
    return <Login onLogin={handleLogin} error={loginError} setError={setLoginError} />
  }

  if (userProfile?.id !== session.user.id) {
    return (
      <div className="login-page">
        <div className="login-panel">
          <p className="eyebrow">NAMAH TRACE · V1.1</p>
          <p className="login-copy">
            {dataError || 'Loading your production profile...'}
          </p>
          {dataError && (
            <button className="secondary-button" onClick={handleLogout}>
              Sign out
            </button>
          )}
        </div>
      </div>
    )
  }

  // Breadcrumbs calculation
  const getBreadcrumbs = () => {
    const crumbs = [{ label: 'Dashboard', onClick: () => handleNavigateView('dashboard') }]

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
      if (activeView === 'flat_yarn') crumbs.push({ label: 'Flat Yarn Batches' })
      if (activeView === 'yarn') crumbs.push({ label: 'Yarn Batches' })
      if (activeView === 'rope') crumbs.push({ label: 'Rope Batches' })
      if (activeView === 'audit') crumbs.push({ label: 'History' })
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
        profile={userProfile}
        isAdmin={userProfile.role === 'admin'}
        storageMode={storageMode}
        onOpenSqlModal={() => setSqlModalOpen(true)}
      />

      <div className="main-layout-wrap">
        {/* Topbar */}
        <Topbar
          onOpenMobileNav={() => setMobileNavOpen(true)}
          breadcrumbs={getBreadcrumbs()}
          onSelectEntity={handleSelectEntity}
          onOpenCreateModal={(tier) => setCreateModal({ open: true, type: tier || 'flat_yarn' })}
          storageMode={storageMode}
          profile={userProfile}
        />

        {/* Main Content Area */}
        <main className="main-scroll-content">
          {dataError && (
            <div className="login-error-box" role="alert">
              {dataError}
            </div>
          )}
          {selectedEntityData ? (
            <EntityDetail
              entity={selectedEntityData}
              isAdmin={userProfile?.role === 'admin'}
              onBack={handleBackFromDetail}
              onNavigateEntity={handleSelectEntity}
              onViewHistory={() => handleNavigateView('audit')}
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
                  onNavigateView={handleNavigateView}
                />
              )}

              {(activeView === 'flat_yarn' || activeView === 'yarn' || activeView === 'rope') && (
                <EntityList
                  type={activeView}
                  entities={entities}
                  onSelectEntity={handleSelectEntity}
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

      {sqlModalOpen && userProfile.role === 'admin' && (
        <SqlMigrationModal onClose={() => setSqlModalOpen(false)} />
      )}
    </div>
  )
}
