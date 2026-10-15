import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react'
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
  getEvidenceDownloadUrl,
} from './lib/api'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Login } from './components/Login'

const Dashboard = lazy(() => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })))
const EntityList = lazy(() => import('./components/EntityList').then((module) => ({ default: module.EntityList })))
const EntityDetail = lazy(() => import('./components/EntityDetail').then((module) => ({ default: module.EntityDetail })))
const AuditTrailView = lazy(() => import('./components/AuditTrailView').then((module) => ({ default: module.AuditTrailView })))
const CreateEntityModal = lazy(() => import('./components/CreateEntityModal').then((module) => ({ default: module.CreateEntityModal })))
const EditBasicInfoModal = lazy(() => import('./components/EditBasicInfoModal').then((module) => ({ default: module.EditBasicInfoModal })))
const AddParameterModal = lazy(() => import('./components/AddParameterModal').then((module) => ({ default: module.AddParameterModal })))
const AddTestModal = lazy(() => import('./components/AddTestModal').then((module) => ({ default: module.AddTestModal })))
const AddProcessModal = lazy(() => import('./components/AddProcessModal').then((module) => ({ default: module.AddProcessModal })))
const UploadEvidenceModal = lazy(() => import('./components/UploadEvidenceModal').then((module) => ({ default: module.UploadEvidenceModal })))
const SqlMigrationModal = lazy(() => import('./components/SqlMigrationModal').then((module) => ({ default: module.SqlMigrationModal })))

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
  const [stockAlertStorageError, setStockAlertStorageError] = useState('')
  const [dismissedStockAlerts, setDismissedStockAlerts] = useState({ userId: null, ids: [] })

  // Modals state
  const [createModal, setCreateModal] = useState({ open: false, type: 'flat_yarn' })
  const [editBasicModalOpen, setEditBasicModalOpen] = useState(false)
  const [addParamModalOpen, setAddParamModalOpen] = useState(false)
  const [addTestModalOpen, setAddTestModalOpen] = useState(false)
  const [addProcessModalOpen, setAddProcessModalOpen] = useState(false)
  const [uploadEvidenceModalOpen, setUploadEvidenceModalOpen] = useState(false)
  const [evidenceTarget, setEvidenceTarget] = useState(null)
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
  const refreshData = useCallback(async ({
    loadProfile = false,
    detailId = null,
  } = {}) => {
    try {
      if (!session?.user?.id) return
      setStorageMode(getStorageMode())

      const [entRes, auditRes, profileRes, detailRes] = await Promise.all([
        listEntities(),
        getGlobalAuditLogs(50),
        loadProfile
          ? getCurrentUserProfile(session.user.id)
          : Promise.resolve({ data: null, error: null }),
        detailId ? getEntity(detailId) : Promise.resolve({ data: null, error: null }),
      ])
      if (entRes.error) throw entRes.error
      if (profileRes.error) throw profileRes.error
      if (detailRes.error) throw detailRes.error

      setEntities(entRes.data)
      setAuditLogs(auditRes)
      if (profileRes.data) setUserProfile(profileRes.data)
      if (detailRes.data) setSelectedEntityData(detailRes.data)
      setDataError('')
    } catch (error) {
      setStorageMode('unavailable')
      setEntities([])
      setAuditLogs([])
      setSelectedEntityData(null)
      setDataError(error.message || 'Unable to load production data from Supabase.')
    }
  }, [session?.user?.id])

  useEffect(() => {
    setUserProfile(null)
    setEntities([])
    setAuditLogs([])
    setSelectedEntityData(null)
    setDataError('')
  }, [session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setDismissedStockAlerts({ userId: null, ids: [] })
      return
    }

    try {
      const savedIds = localStorage.getItem(`namah-trace:dismissed-stock-alerts:${userId}`)
      const ids = savedIds ? JSON.parse(savedIds) : []
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
        throw new Error('Saved dismissed stock alerts have an invalid format.')
      }
      setDismissedStockAlerts({ userId, ids: [...new Set(ids)] })
      setStockAlertStorageError('')
    } catch (error) {
      setDismissedStockAlerts({ userId, ids: [] })
      setStockAlertStorageError(error.message || 'Unable to load dismissed stock alerts.')
    }
  }, [session?.user?.id])

  const handleDismissStockAlerts = (entityIds) => {
    const userId = session?.user?.id
    if (!userId) {
      setDataError('Sign in to dismiss stock alerts.')
      return
    }

    const currentIds = dismissedStockAlerts.userId === userId ? dismissedStockAlerts.ids : []
    const nextIds = [...new Set([...currentIds, ...entityIds])]
    try {
      localStorage.setItem(`namah-trace:dismissed-stock-alerts:${userId}`, JSON.stringify(nextIds))
      setDismissedStockAlerts({ userId, ids: nextIds })
      setStockAlertStorageError('')
    } catch (error) {
      setStockAlertStorageError(error.message || 'Unable to save dismissed stock alerts.')
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      refreshData({ loadProfile: true })
    }
  }, [session?.user?.id, refreshData])

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

  const finishMutation = async (result, detailId = selectedEntityId) => {
    if (result.data || result.error?.operationCommitted) {
      await refreshData({ detailId })
    }
    if (result.error) setDataError(result.error.message)
    return result
  }

  const handleDownloadEvidence = async (evidenceId) => {
    if (!selectedEntityId || !evidenceId) return
    const downloadWindow = window.open('about:blank', '_blank')
    if (!downloadWindow) {
      setDataError('Allow pop-ups to download evidence.')
      return
    }
    downloadWindow.opener = null

    const result = await getEvidenceDownloadUrl(selectedEntityId, evidenceId)
    if (result.error) {
      downloadWindow.close()
      setDataError(result.error.message)
      return
    }
    const downloadUrl = result.data
    if (downloadUrl) {
      downloadWindow.location.href = downloadUrl
      setDataError('')
    }
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
    return finishMutation(res, null)
  }

  const handleCreateYarnBatch = async (params) => {
    const res = await createYarnBatch(params)
    if (res.data) setSelectedEntityId(res.data.id)
    return finishMutation(res, null)
  }

  const handleCreateRopeBatch = async (params) => {
    const res = await createRopeBatch(params)
    if (res.data) setSelectedEntityId(res.data.id)
    return finishMutation(res, null)
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
    const { evidenceFile, ...fields } = param
    const result = await addParameter(selectedEntityId, fields)
    return finishRecordWithEvidence(result, evidenceFile, 'parameter')
  }

  const handleDeleteParameter = async (paramId, paramName) => {
    if (!selectedEntityId) return
    if (!window.confirm(`Remove parameter "${paramName}"?`)) return
    return finishMutation(await deleteParameter(selectedEntityId, paramId))
  }

  // Test Handlers
  const handleAddTest = async (test) => {
    if (!selectedEntityId) return
    const { evidenceFile, ...fields } = test
    const result = await addTest(selectedEntityId, fields)
    return finishRecordWithEvidence(result, evidenceFile, 'test')
  }

  const handleDeleteTest = async (testId, testName) => {
    if (!selectedEntityId) return
    if (!window.confirm(`Delete test record "${testName}"?`)) return
    return finishMutation(await deleteTest(selectedEntityId, testId))
  }

  // Process Handlers
  const handleAddProcess = async (proc) => {
    if (!selectedEntityId) return
    const { evidenceFile, ...fields } = proc
    const result = await addProcess(selectedEntityId, fields)
    return finishRecordWithEvidence(result, evidenceFile, 'process')
  }

  // Evidence Handlers
  const finishRecordWithEvidence = async (recordResult, file, recordType) => {
    if (recordResult.error || !file || !selectedEntityId) {
      return finishMutation(recordResult)
    }

    const evidenceResult = await addEvidence(selectedEntityId, {
      file,
      [`${recordType}Id`]: recordResult.data.id,
    })
    if (evidenceResult.error) {
      const error = new Error(
        `${recordType[0].toUpperCase()}${recordType.slice(1)} saved, but evidence upload failed: ${evidenceResult.error.message}`
      )
      error.operationCommitted = true
      error.recordSaved = true
      return finishMutation({ data: null, error })
    }
    return finishMutation(recordResult)
  }

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
  const dismissedIds = new Set(
    dismissedStockAlerts.userId === session.user.id ? dismissedStockAlerts.ids : [],
  )
  const visibleLowStockEntities = entities.filter(
    (entity) => entity.lowStock && !dismissedIds.has(entity.id),
  )

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
          notifications={visibleLowStockEntities}
          onDismissNotifications={handleDismissStockAlerts}
        />

        {/* Main Content Area */}
        <main className="main-scroll-content">
          {dataError && (
            <div className="login-error-box" role="alert">
              {dataError}
            </div>
          )}
          {stockAlertStorageError && (
            <div className="login-error-box" role="alert">
              Unable to persist dismissed stock alerts: {stockAlertStorageError}
            </div>
          )}
          <Suspense fallback={<div className="page-loading-state">Loading workspace...</div>}>
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
              onOpenUploadEvidenceModal={() => {
                setEvidenceTarget(null)
                setUploadEvidenceModalOpen(true)
              }}
              onAttachEvidence={(type, id) => {
                setEvidenceTarget({ type, id })
                setUploadEvidenceModalOpen(true)
              }}
              onDownloadEvidence={handleDownloadEvidence}
              onDeleteParam={handleDeleteParameter}
              onDeleteTest={handleDeleteTest}
              onUpdateStatus={handleUpdateStatus}
            />
          ) : (
            <>
              {activeView === 'dashboard' && (
                <Dashboard
                  entities={entities}
                  lowStockEntities={visibleLowStockEntities}
                  onDismissStockAlert={handleDismissStockAlerts}
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
          </Suspense>
        </main>
      </div>

      {/* MODALS */}
      <Suspense fallback={null}>
      {createModal.open && (
        <CreateEntityModal
          initialType={createModal.type}
          availableFlatYarns={availableFlatYarns}
          availableYarns={availableYarns}
          isAdmin={userProfile.role === 'admin'}
          onClose={() => setCreateModal({ open: false, type: 'flat_yarn' })}
          onCreateFlatYarn={handleCreateFlatYarn}
          onCreateYarnBatch={handleCreateYarnBatch}
          onCreateRopeBatch={handleCreateRopeBatch}
        />
      )}

      {editBasicModalOpen && selectedEntityData && (
        <EditBasicInfoModal
          entity={selectedEntityData}
          isAdmin={userProfile.role === 'admin'}
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
          entityType={selectedEntityData.type}
          processes={selectedEntityData.processes || []}
          onClose={() => setAddTestModalOpen(false)}
          onSave={handleAddTest}
        />
      )}

      {addProcessModalOpen && selectedEntityData && (
        <AddProcessModal
          entityType={selectedEntityData.type}
          onClose={() => setAddProcessModalOpen(false)}
          onSave={handleAddProcess}
        />
      )}

      {uploadEvidenceModalOpen && selectedEntityData && (
        <UploadEvidenceModal
          entity={selectedEntityData}
          initialTarget={evidenceTarget}
          onClose={() => {
            setEvidenceTarget(null)
            setUploadEvidenceModalOpen(false)
          }}
          onUpload={handleUploadEvidence}
        />
      )}

      {sqlModalOpen && userProfile.role === 'admin' && (
        <SqlMigrationModal onClose={() => setSqlModalOpen(false)} />
      )}
      </Suspense>
    </div>
  )
}
