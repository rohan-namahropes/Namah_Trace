import { supabase } from './supabase'

const STORAGE_KEY = 'namah_trace_v1_store'

// Initial reference seed dataset according to V1 Specification Scenario (Section 26)
const defaultSeed = {
  entities: [
    {
      id: 'fy-523',
      type: 'flat_yarn',
      batch_id: '523',
      supplier: 'ABC',
      treatment: null,
      quantity: 500,
      unit: 'kg',
      status: 'In Progress',
      notes: 'High-tenacity raw polyester flat yarn received from ABC Corp. Good luster and zero visible slubs.',
      created_by_name: 'Production Operator',
      created_at: '2026-08-18T08:15:00Z',
      updated_at: '2026-08-18T10:30:00Z',
    },
    {
      id: 'yb-523-ta',
      type: 'yarn',
      batch_id: '523 TA',
      supplier: null,
      treatment: 'Twisting @ 1600 TPM',
      quantity: 100,
      unit: 'kg',
      status: 'In Progress',
      notes: 'Portion drawn from Flat Yarn 523 for core load-bearing strands.',
      created_by_name: 'Arjun S.',
      created_at: '2026-08-19T09:00:00Z',
      updated_at: '2026-08-20T11:45:00Z',
    },
    {
      id: 'yb-523-pb',
      type: 'yarn',
      batch_id: '523 PB',
      supplier: null,
      treatment: 'Twisting @ 1200 TPM',
      quantity: 200,
      unit: 'kg',
      status: 'In Progress',
      notes: 'Second portion drawn from Flat Yarn 523 for outer protective sheath.',
      created_by_name: 'Priya K.',
      created_at: '2026-08-19T14:30:00Z',
      updated_at: '2026-08-19T16:00:00Z',
    },
    {
      id: 'rb-5417',
      type: 'rope',
      batch_id: '5417',
      supplier: null,
      treatment: null,
      quantity: 300,
      unit: 'meters',
      status: 'Completed',
      notes: '16-strand static kernmantle mountain climbing rope. Batch passed all static tensile tests.',
      created_by_name: 'Quality Lead',
      created_at: '2026-08-21T08:00:00Z',
      updated_at: '2026-08-23T16:30:00Z',
    },
  ],
  genealogy: [
    // 523 -> 523 TA
    {
      id: 'gen-1',
      parent_entity_id: 'fy-523',
      child_entity_id: 'yb-523-ta',
      quantity_used: 100,
      unit: 'kg',
      remarks: '100 kg drawn for core yarn twisting',
      created_at: '2026-08-19T09:00:00Z',
    },
    // 523 -> 523 PB
    {
      id: 'gen-2',
      parent_entity_id: 'fy-523',
      child_entity_id: 'yb-523-pb',
      quantity_used: 200,
      unit: 'kg',
      remarks: '200 kg drawn for sheath yarn twisting',
      created_at: '2026-08-19T14:30:00Z',
    },
    // 523 TA -> 5417
    {
      id: 'gen-3',
      parent_entity_id: 'yb-523-ta',
      child_entity_id: 'rb-5417',
      quantity_used: 85,
      unit: 'kg',
      remarks: 'Used as inner kern core',
      created_at: '2026-08-21T08:00:00Z',
    },
    // 523 PB -> 5417
    {
      id: 'gen-4',
      parent_entity_id: 'yb-523-pb',
      child_entity_id: 'rb-5417',
      quantity_used: 115,
      unit: 'kg',
      remarks: 'Used as outer braided mantle',
      created_at: '2026-08-21T08:00:00Z',
    },
  ],
  parameters: [
    // 523 parameters
    { id: 'p-1', entity_id: 'fy-523', name: 'BS', value: '28.4', unit: 'kN', remarks: 'Breaking Strength of virgin filament', created_at: '2026-08-18T09:00:00Z' },
    { id: 'p-2', entity_id: 'fy-523', name: 'Elongation', value: '3.8', unit: '%', remarks: 'Elongation at break', created_at: '2026-08-18T09:05:00Z' },
    { id: 'p-3', entity_id: 'fy-523', name: 'Denier', value: '1100', unit: 'D', remarks: 'Linear mass density', created_at: '2026-08-18T09:10:00Z' },
    // 523 TA parameters
    { id: 'p-4', entity_id: 'yb-523-ta', name: 'TPM', value: '1600', unit: 'TPM', remarks: 'Twists per meter target', created_at: '2026-08-19T09:15:00Z' },
    { id: 'p-5', entity_id: 'yb-523-ta', name: 'Twist Direction', value: 'S', unit: '', remarks: 'S-direction twist', created_at: '2026-08-19T09:20:00Z' },
    // 523 PB parameters
    { id: 'p-6', entity_id: 'yb-523-pb', name: 'TPM', value: '1200', unit: 'TPM', remarks: 'Sheath twist target', created_at: '2026-08-19T14:40:00Z' },
    // 5417 parameters
    { id: 'p-7', entity_id: 'rb-5417', name: 'Diameter', value: '10.5', unit: 'mm', remarks: 'Standard EN 892 specification', created_at: '2026-08-21T09:00:00Z' },
    { id: 'p-8', entity_id: 'rb-5417', name: 'Linear Mass', value: '68.5', unit: 'g/m', remarks: 'Core + mantle total weight', created_at: '2026-08-21T09:10:00Z' },
    { id: 'p-9', entity_id: 'rb-5417', name: 'Sheath Slippage', value: '0.12', unit: '%', remarks: 'Within < 0.5% tolerance', created_at: '2026-08-21T09:15:00Z' },
  ],
  tests: [
    { id: 't-1', entity_id: 'fy-523', test_name: 'Tensile Breakdown Test', value: '28.4', unit: 'kN', result: 'Pass', remarks: 'Clear tensile curve, no necking', performed_by_name: 'QC Analyst', tested_at: '2026-08-18T10:00:00Z', created_at: '2026-08-18T10:00:00Z' },
    { id: 't-2', entity_id: 'yb-523-ta', test_name: 'Twist Uniformity Test', value: '1592', unit: 'TPM', result: 'Pass', remarks: 'Measured across 5 sample segments', performed_by_name: 'Arjun S.', tested_at: '2026-08-19T11:00:00Z', created_at: '2026-08-19T11:00:00Z' },
    { id: 't-3', entity_id: 'rb-5417', test_name: 'Static Breaking Load', value: '33.2', unit: 'kN', result: 'Pass', remarks: 'Exceeds EN 1891 Type A 22 kN standard', performed_by_name: 'Quality Lead', tested_at: '2026-08-23T14:00:00Z', created_at: '2026-08-23T14:00:00Z' },
    { id: 't-4', entity_id: 'rb-5417', test_name: 'Static Elongation (50-150kg)', value: '3.2', unit: '%', result: 'Pass', remarks: 'Well below 5% requirement', performed_by_name: 'Quality Lead', tested_at: '2026-08-23T14:30:00Z', created_at: '2026-08-23T14:30:00Z' },
  ],
  processes: [
    { id: 'pr-1', entity_id: 'yb-523-ta', process_name: 'Twisting', specification: '1600 TPM / Spindle Speed 7200 RPM', remarks: 'Twisting completed on Machine #04', performed_by_name: 'Production Operator', performed_at: '2026-08-19T09:30:00Z', created_at: '2026-08-19T09:30:00Z' },
    { id: 'pr-2', entity_id: 'yb-523-ta', process_name: 'Heat Setting', specification: '180°C / 30 min in steam chamber', remarks: 'Uniform heat penetration. No thermal discolouration.', performed_by_name: 'Production Lead', performed_at: '2026-08-20T10:15:00Z', created_at: '2026-08-20T10:15:00Z' },
    { id: 'pr-3', entity_id: 'yb-523-pb', process_name: 'Twisting', specification: '1200 TPM Z-twist', remarks: 'Finished without tension spikes', performed_by_name: 'Priya K.', performed_at: '2026-08-19T15:00:00Z', created_at: '2026-08-19T15:00:00Z' },
    { id: 'pr-4', entity_id: 'rb-5417', process_name: 'Braiding', specification: '16-carrier Herzog braider, core pre-tension 40N', remarks: 'Braiding run completed across 300 meters continuous length.', performed_by_name: 'Arjun S.', performed_at: '2026-08-22T13:00:00Z', created_at: '2026-08-22T13:00:00Z' },
    { id: 'pr-5', entity_id: 'rb-5417', process_name: 'Finishing & Inspection', specification: 'Hot-knife end sealing and visual defect scan', remarks: 'Sealed both ends with shrink wrap trace labels.', performed_by_name: 'Quality Lead', performed_at: '2026-08-23T15:00:00Z', created_at: '2026-08-23T15:00:00Z' },
  ],
  evidence: [
    { id: 'ev-1', entity_id: 'fy-523', file_name: 'ABC_Certificate_of_Analysis_523.pdf', storage_path: 'mock/523/coa.pdf', mime_type: 'application/pdf', file_size: 245000, uploaded_by_name: 'Production Operator', created_at: '2026-08-18T08:30:00Z' },
    { id: 'ev-2', entity_id: 'yb-523-ta', file_name: 'Twist_Inspection_Photo_523TA.jpg', storage_path: 'mock/523ta/photo.jpg', mime_type: 'image/jpeg', file_size: 1420000, uploaded_by_name: 'Arjun S.', created_at: '2026-08-19T11:15:00Z' },
    { id: 'ev-3', entity_id: 'rb-5417', file_name: 'Batch_5417_Conformance_Cert.pdf', storage_path: 'mock/5417/cert.pdf', mime_type: 'application/pdf', file_size: 380000, uploaded_by_name: 'Quality Lead', created_at: '2026-08-23T15:30:00Z' },
  ],
  audit_logs: [
    { id: 'a-1', entity_id: 'fy-523', action: 'Created Flat Yarn Batch 523', field_name: null, old_value: null, new_value: 'Supplier: ABC', performed_by_name: 'Production Operator', created_at: '2026-08-18T08:15:00Z' },
    { id: 'a-2', entity_id: 'fy-523', action: 'Added parameter BS', field_name: 'BS', old_value: null, new_value: '28.4 kN', performed_by_name: 'Production Operator', created_at: '2026-08-18T09:00:00Z' },
    { id: 'a-3', entity_id: 'fy-523', action: 'Added parameter Elongation', field_name: 'Elongation', old_value: null, new_value: '3.8 %', performed_by_name: 'Production Operator', created_at: '2026-08-18T09:05:00Z' },
    { id: 'a-4', entity_id: 'fy-523', action: 'Added parameter Denier', field_name: 'Denier', old_value: null, new_value: '1100 D', performed_by_name: 'Production Operator', created_at: '2026-08-18T09:10:00Z' },
    { id: 'a-5', entity_id: 'yb-523-ta', action: 'Created Yarn Batch 523 TA', field_name: 'Genealogy', old_value: null, new_value: 'Parent: 523 (100 kg)', performed_by_name: 'Arjun S.', created_at: '2026-08-19T09:00:00Z' },
    { id: 'a-6', entity_id: 'yb-523-ta', action: 'Added process Heat Setting', field_name: 'Process', old_value: null, new_value: '180°C / 30 min', performed_by_name: 'Production Lead', created_at: '2026-08-20T10:15:00Z' },
    { id: 'a-7', entity_id: 'yb-523-pb', action: 'Created Yarn Batch 523 PB', field_name: 'Genealogy', old_value: null, new_value: 'Parent: 523 (200 kg)', performed_by_name: 'Priya K.', created_at: '2026-08-19T14:30:00Z' },
    { id: 'a-8', entity_id: 'rb-5417', action: 'Created Rope Batch 5417', field_name: 'Genealogy', old_value: null, new_value: 'Parents: 523 TA, 523 PB', performed_by_name: 'Quality Lead', created_at: '2026-08-21T08:00:00Z' },
    { id: 'a-9', entity_id: 'rb-5417', action: 'Status changed to Completed', field_name: 'status', old_value: 'In Progress', new_value: 'Completed', performed_by_name: 'Quality Lead', created_at: '2026-08-23T16:30:00Z' },
  ],
}

// Local store helpers
function getLocalStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSeed))
      return JSON.parse(JSON.stringify(defaultSeed))
    }
    return JSON.parse(raw)
  } catch (err) {
    console.error('Error reading localStorage store, using default seed:', err)
    return JSON.parse(JSON.stringify(defaultSeed))
  }
}

function saveLocalStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (err) {
    console.error('Error writing to localStorage:', err)
  }
}

export function resetWorkspaceToSeed() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSeed))
  return JSON.parse(JSON.stringify(defaultSeed))
}

// Check if Supabase connection is currently active and has the V1 entities table
let supabaseStatus = { tested: false, available: false }

export async function checkSupabaseAvailable() {
  if (!supabase) {
    supabaseStatus = { tested: true, available: false }
    return false
  }
  try {
    const { error } = await supabase.from('entities').select('id').limit(1)
    if (error) {
      // Table doesn't exist yet or connection error
      supabaseStatus = { tested: true, available: false }
      return false
    }
    supabaseStatus = { tested: true, available: true }
    return true
  } catch {
    supabaseStatus = { tested: true, available: false }
    return false
  }
}

export function getStorageMode() {
  return supabaseStatus.available ? 'supabase' : 'local'
}

// ------------------------------------------------------------------------------
// ENTITY LIST & QUERY FUNCTIONS
// ------------------------------------------------------------------------------

export async function listEntities(type = null) {
  const isAvailable = await checkSupabaseAvailable()
  if (isAvailable) {
    try {
      let query = supabase.from('entities').select('*').order('created_at', { ascending: false })
      if (type) query = query.eq('type', type)
      const { data, error } = await query
      if (!error && data) return { data, error: null }
    } catch (err) {
      console.warn('Supabase query failed, falling back to local store:', err)
    }
  }

  // Local fallback
  const store = getLocalStore()
  let list = store.entities
  if (type) {
    list = list.filter((e) => e.type === type)
  }
  // Sort descending by created_at
  list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return { data: list, error: null }
}

export async function getEntity(idOrBatchId) {
  const store = getLocalStore()
  const entity = store.entities.find((e) => e.id === idOrBatchId || e.batch_id.toLowerCase() === String(idOrBatchId).toLowerCase())
  if (!entity) return { data: null, error: new Error('Entity not found') }

  const entityId = entity.id

  // Parameters
  const parameters = store.parameters
    .filter((p) => p.entity_id === entityId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  // Tests
  const tests = store.tests
    .filter((t) => t.entity_id === entityId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  // Processes
  const processes = store.processes
    .filter((pr) => pr.entity_id === entityId)
    .sort((a, b) => new Date(a.performed_at || a.created_at) - new Date(b.performed_at || b.created_at))

  // Evidence
  const evidence = store.evidence
    .filter((ev) => ev.entity_id === entityId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // Audit Logs
  const auditLogs = store.audit_logs
    .filter((a) => a.entity_id === entityId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // Bidirectional Genealogy Resolution
  const genealogy = resolveGenealogy(entity, store)

  return {
    data: {
      ...entity,
      parameters,
      tests,
      processes,
      evidence,
      auditLogs,
      genealogy,
    },
    error: null,
  }
}

// Resolve full genealogy tree for an entity
export function resolveGenealogy(entity, store = getLocalStore()) {
  const entityId = entity.id
  const type = entity.type

  // Direct Parents
  const parentLinks = store.genealogy.filter((g) => g.child_entity_id === entityId)
  const parents = parentLinks.map((link) => {
    const parentEntity = store.entities.find((e) => e.id === link.parent_entity_id)
    return {
      linkId: link.id,
      entityId: link.parent_entity_id,
      batchId: parentEntity?.batch_id || 'Unknown',
      type: parentEntity?.type || 'unknown',
      supplier: parentEntity?.supplier || null,
      treatment: parentEntity?.treatment || null,
      quantityUsed: link.quantity_used,
      unit: link.unit || parentEntity?.unit,
      remarks: link.remarks,
    }
  })

  // Grandparents (Original Flat Yarn for Rope batches)
  const grandparents = []
  if (type === 'rope') {
    parents.forEach((parent) => {
      const gParentLinks = store.genealogy.filter((g) => g.child_entity_id === parent.entityId)
      gParentLinks.forEach((gLink) => {
        const gEntity = store.entities.find((e) => e.id === gLink.parent_entity_id)
        if (gEntity && !grandparents.some((gp) => gp.entityId === gEntity.id)) {
          grandparents.push({
            entityId: gEntity.id,
            batchId: gEntity.batch_id,
            type: gEntity.type,
            supplier: gEntity.supplier,
            viaYarnBatch: parent.batchId,
          })
        }
      })
    })
  }

  // Direct Children (Derived Batches)
  const childLinks = store.genealogy.filter((g) => g.parent_entity_id === entityId)
  const children = childLinks.map((link) => {
    const childEntity = store.entities.find((e) => e.id === link.child_entity_id)
    return {
      linkId: link.id,
      entityId: link.child_entity_id,
      batchId: childEntity?.batch_id || 'Unknown',
      type: childEntity?.type || 'unknown',
      treatment: childEntity?.treatment || null,
      quantityUsed: link.quantity_used,
      unit: link.unit || childEntity?.unit,
      status: childEntity?.status,
      remarks: link.remarks,
    }
  })

  // Grandchildren (Downstream Ropes for Flat Yarn)
  const grandchildren = []
  if (type === 'flat_yarn') {
    children.forEach((child) => {
      const gcLinks = store.genealogy.filter((g) => g.parent_entity_id === child.entityId)
      gcLinks.forEach((gcLink) => {
        const gcEntity = store.entities.find((e) => e.id === gcLink.child_entity_id)
        if (gcEntity && !grandchildren.some((gc) => gc.entityId === gcEntity.id)) {
          grandchildren.push({
            entityId: gcEntity.id,
            batchId: gcEntity.batch_id,
            type: gcEntity.type,
            status: gcEntity.status,
            viaYarnBatch: child.batchId,
          })
        }
      })
    })
  }

  return {
    parents,
    grandparents,
    children,
    grandchildren,
  }
}

// ------------------------------------------------------------------------------
// CREATION FUNCTIONS
// ------------------------------------------------------------------------------

export async function createFlatYarn({ batchId, supplier, quantity, unit = 'kg', notes }, user) {
  const store = getLocalStore()
  const cleanBatchId = String(batchId).trim()

  if (store.entities.some((e) => e.batch_id.toLowerCase() === cleanBatchId.toLowerCase())) {
    return { data: null, error: new Error(`Batch ID "${cleanBatchId}" already exists.`) }
  }

  const newId = `fy-${Date.now()}`
  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  const entity = {
    id: newId,
    type: 'flat_yarn',
    batch_id: cleanBatchId,
    supplier: supplier?.trim() || null,
    treatment: null,
    quantity: quantity ? Number(quantity) : null,
    unit: unit || 'kg',
    status: 'In Progress',
    notes: notes?.trim() || '',
    created_by_name: userName,
    created_at: now,
    updated_at: now,
  }

  store.entities.unshift(entity)

  // Audit log
  store.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    entity_id: newId,
    action: `Created Flat Yarn Batch ${cleanBatchId}`,
    field_name: 'creation',
    old_value: null,
    new_value: `Supplier: ${supplier || 'None'}`,
    performed_by_name: userName,
    created_at: now,
  })

  saveLocalStore(store)

  // Attempt Supabase insert if available
  if (supabaseStatus.available && supabase) {
    try {
      await supabase.from('entities').insert({
        batch_id: entity.batch_id,
        type: entity.type,
        supplier: entity.supplier,
        quantity: entity.quantity,
        unit: entity.unit,
        status: entity.status,
        notes: entity.notes,
        created_by: user?.id,
      })
    } catch (e) {
      console.warn('Supabase remote insert failed:', e)
    }
  }

  return { data: entity, error: null }
}

export async function createYarnBatch({ batchId, parentEntityId, treatment, quantity, unit = 'kg', remarks, notes }, user) {
  const store = getLocalStore()
  const cleanBatchId = String(batchId).trim()

  if (store.entities.some((e) => e.batch_id.toLowerCase() === cleanBatchId.toLowerCase())) {
    return { data: null, error: new Error(`Batch ID "${cleanBatchId}" already exists.`) }
  }

  const parentEntity = store.entities.find((e) => e.id === parentEntityId)
  if (!parentEntity) {
    return { data: null, error: new Error('Selected parent Flat Yarn Batch was not found.') }
  }

  const newId = `yb-${Date.now()}`
  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  const entity = {
    id: newId,
    type: 'yarn',
    batch_id: cleanBatchId,
    supplier: null,
    treatment: treatment?.trim() || null,
    quantity: quantity ? Number(quantity) : null,
    unit: unit || 'kg',
    status: 'In Progress',
    notes: notes?.trim() || remarks?.trim() || '',
    created_by_name: userName,
    created_at: now,
    updated_at: now,
  }

  store.entities.unshift(entity)

  // Add genealogy link
  const genealogyLink = {
    id: `gen-${Date.now()}`,
    parent_entity_id: parentEntity.id,
    child_entity_id: newId,
    quantity_used: quantity ? Number(quantity) : null,
    unit: unit || 'kg',
    remarks: remarks?.trim() || `Derived from ${parentEntity.batch_id}`,
    created_at: now,
  }
  store.genealogy.push(genealogyLink)

  // Audit log for yarn batch
  store.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    entity_id: newId,
    action: `Created Yarn Batch ${cleanBatchId} from Flat Yarn ${parentEntity.batch_id}`,
    field_name: 'genealogy',
    old_value: null,
    new_value: `Parent: ${parentEntity.batch_id} (${quantity ? `${quantity} ${unit}` : 'unspecified portion'})`,
    performed_by_name: userName,
    created_at: now,
  })

  // Audit log on parent flat yarn batch
  store.audit_logs.unshift({
    id: `audit-fy-${Date.now()}`,
    entity_id: parentEntity.id,
    action: `Portion derived into Yarn Batch ${cleanBatchId}`,
    field_name: 'downstream_usage',
    old_value: null,
    new_value: `Yarn Batch: ${cleanBatchId} (${quantity ? `${quantity} ${unit}` : 'unspecified'}) - Treatment: ${treatment || 'None'}`,
    performed_by_name: userName,
    created_at: now,
  })

  saveLocalStore(store)

  return { data: entity, error: null }
}

export async function createRopeBatch({ batchId, parentEntityIds, quantity, unit = 'meters', notes, remarks }, user) {
  const store = getLocalStore()
  const cleanBatchId = String(batchId).trim()

  if (store.entities.some((e) => e.batch_id.toLowerCase() === cleanBatchId.toLowerCase())) {
    return { data: null, error: new Error(`Batch ID "${cleanBatchId}" already exists.`) }
  }

  if (!parentEntityIds || parentEntityIds.length === 0) {
    return { data: null, error: new Error('At least one parent Yarn Batch must be selected.') }
  }

  const selectedParents = store.entities.filter((e) => parentEntityIds.includes(e.id))
  if (selectedParents.length === 0) {
    return { data: null, error: new Error('Selected parent Yarn Batches not found.') }
  }

  const newId = `rb-${Date.now()}`
  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  const entity = {
    id: newId,
    type: 'rope',
    batch_id: cleanBatchId,
    supplier: null,
    treatment: null,
    quantity: quantity ? Number(quantity) : null,
    unit: unit || 'meters',
    status: 'In Progress',
    notes: notes?.trim() || remarks?.trim() || '',
    created_by_name: userName,
    created_at: now,
    updated_at: now,
  }

  store.entities.unshift(entity)

  // Add genealogy links for each selected yarn batch
  selectedParents.forEach((parent, index) => {
    store.genealogy.push({
      id: `gen-${Date.now()}-${index}`,
      parent_entity_id: parent.id,
      child_entity_id: newId,
      quantity_used: null,
      unit: parent.unit || 'kg',
      remarks: `Used in rope batch ${cleanBatchId}`,
      created_at: now,
    })

    // Log on parent yarn
    store.audit_logs.unshift({
      id: `audit-yarn-${Date.now()}-${index}`,
      entity_id: parent.id,
      action: `Material used in Rope Batch ${cleanBatchId}`,
      field_name: 'downstream_usage',
      old_value: null,
      new_value: `Rope Batch: ${cleanBatchId}`,
      performed_by_name: userName,
      created_at: now,
    })
  })

  // Audit log on rope batch
  const parentNames = selectedParents.map((p) => p.batch_id).join(', ')
  store.audit_logs.unshift({
    id: `audit-${Date.now()}`,
    entity_id: newId,
    action: `Created Rope Batch ${cleanBatchId}`,
    field_name: 'genealogy',
    old_value: null,
    new_value: `Composed of Yarn Batches: ${parentNames}`,
    performed_by_name: userName,
    created_at: now,
  })

  saveLocalStore(store)

  return { data: entity, error: null }
}

// ------------------------------------------------------------------------------
// EDIT & AUDIT FUNCTIONS
// ------------------------------------------------------------------------------

export async function updateEntityBasicInfo(entityId, updates, user) {
  const store = getLocalStore()
  const entity = store.entities.find((e) => e.id === entityId)
  if (!entity) return { data: null, error: new Error('Entity not found') }

  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  const auditEvents = []

  // Check supplier change
  if ('supplier' in updates && updates.supplier !== entity.supplier) {
    auditEvents.push({
      action: `Supplier changed from "${entity.supplier || 'None'}" to "${updates.supplier || 'None'}"`,
      field_name: 'supplier',
      old_value: entity.supplier || '',
      new_value: updates.supplier || '',
    })
    entity.supplier = updates.supplier
  }

  // Check treatment change
  if ('treatment' in updates && updates.treatment !== entity.treatment) {
    auditEvents.push({
      action: `Treatment changed from "${entity.treatment || 'None'}" to "${updates.treatment || 'None'}"`,
      field_name: 'treatment',
      old_value: entity.treatment || '',
      new_value: updates.treatment || '',
    })
    entity.treatment = updates.treatment
  }

  // Check quantity change
  if ('quantity' in updates && Number(updates.quantity) !== Number(entity.quantity)) {
    auditEvents.push({
      action: `Quantity changed from ${entity.quantity || '0'} to ${updates.quantity || '0'} ${entity.unit || ''}`,
      field_name: 'quantity',
      old_value: String(entity.quantity || ''),
      new_value: String(updates.quantity || ''),
    })
    entity.quantity = updates.quantity ? Number(updates.quantity) : null
  }

  // Check unit change
  if ('unit' in updates && updates.unit !== entity.unit) {
    entity.unit = updates.unit
  }

  // Check notes change
  if ('notes' in updates && updates.notes !== entity.notes) {
    auditEvents.push({
      action: 'Updated notes / remarks',
      field_name: 'notes',
      old_value: entity.notes ? entity.notes.slice(0, 30) + '...' : '',
      new_value: updates.notes ? updates.notes.slice(0, 30) + '...' : '',
    })
    entity.notes = updates.notes
  }

  entity.updated_at = now

  // Append audit logs
  auditEvents.forEach((ev, i) => {
    store.audit_logs.unshift({
      id: `audit-upd-${Date.now()}-${i}`,
      entity_id: entityId,
      action: ev.action,
      field_name: ev.field_name,
      old_value: ev.old_value,
      new_value: ev.new_value,
      performed_by_name: userName,
      created_at: now,
    })
  })

  saveLocalStore(store)
  return getEntity(entityId)
}

export async function updateEntityStatus(entityId, newStatus, user) {
  const store = getLocalStore()
  const entity = store.entities.find((e) => e.id === entityId)
  if (!entity) return { data: null, error: new Error('Entity not found') }

  const oldStatus = entity.status || 'Not Set'
  entity.status = newStatus
  entity.updated_at = new Date().toISOString()

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  store.audit_logs.unshift({
    id: `audit-status-${Date.now()}`,
    entity_id: entityId,
    action: `Status changed from "${oldStatus}" to "${newStatus || 'Not Set'}"`,
    field_name: 'status',
    old_value: oldStatus,
    new_value: newStatus || 'Not Set',
    performed_by_name: userName,
    created_at: entity.updated_at,
  })

  saveLocalStore(store)
  return getEntity(entityId)
}

// ------------------------------------------------------------------------------
// PARAMETERS
// ------------------------------------------------------------------------------

export async function addParameter(entityId, { name, value, unit, remarks }, user) {
  const store = getLocalStore()
  const entity = store.entities.find((e) => e.id === entityId)
  if (!entity) return { data: null, error: new Error('Entity not found') }

  const cleanName = String(name).trim()
  const cleanVal = String(value).trim()
  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  const param = {
    id: `param-${Date.now()}`,
    entity_id: entityId,
    name: cleanName,
    value: cleanVal,
    unit: unit?.trim() || '',
    remarks: remarks?.trim() || '',
    created_at: now,
  }

  store.parameters.push(param)

  store.audit_logs.unshift({
    id: `audit-param-${Date.now()}`,
    entity_id: entityId,
    action: `Added parameter ${cleanName}`,
    field_name: 'parameter',
    old_value: null,
    new_value: `${cleanVal} ${unit || ''}`.trim(),
    performed_by_name: userName,
    created_at: now,
  })

  entity.updated_at = now
  saveLocalStore(store)
  return getEntity(entityId)
}

export async function deleteParameter(entityId, paramId, user) {
  const store = getLocalStore()
  const param = store.parameters.find((p) => p.id === paramId && p.entity_id === entityId)
  if (!param) return { data: null, error: new Error('Parameter not found') }

  store.parameters = store.parameters.filter((p) => p.id !== paramId)

  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  store.audit_logs.unshift({
    id: `audit-del-param-${Date.now()}`,
    entity_id: entityId,
    action: `Removed parameter ${param.name}`,
    field_name: 'parameter',
    old_value: `${param.value} ${param.unit || ''}`.trim(),
    new_value: null,
    performed_by_name: userName,
    created_at: now,
  })

  saveLocalStore(store)
  return getEntity(entityId)
}

// ------------------------------------------------------------------------------
// TESTS & QC
// ------------------------------------------------------------------------------

export async function addTest(entityId, { testName, value, unit, remarks, result = 'Pass' }, user) {
  const store = getLocalStore()
  const entity = store.entities.find((e) => e.id === entityId)
  if (!entity) return { data: null, error: new Error('Entity not found') }

  const cleanName = String(testName).trim()
  const cleanVal = String(value).trim()
  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  const test = {
    id: `test-${Date.now()}`,
    entity_id: entityId,
    test_name: cleanName,
    value: cleanVal,
    unit: unit?.trim() || '',
    result: result || 'Pass',
    remarks: remarks?.trim() || '',
    performed_by_name: userName,
    tested_at: now,
    created_at: now,
  }

  store.tests.push(test)

  store.audit_logs.unshift({
    id: `audit-test-${Date.now()}`,
    entity_id: entityId,
    action: `Recorded test: ${cleanName}`,
    field_name: 'test',
    old_value: null,
    new_value: `${cleanVal} ${unit || ''} [${result}]`.trim(),
    performed_by_name: userName,
    created_at: now,
  })

  entity.updated_at = now
  saveLocalStore(store)
  return getEntity(entityId)
}

export async function deleteTest(entityId, testId, user) {
  const store = getLocalStore()
  const test = store.tests.find((t) => t.id === testId && t.entity_id === entityId)
  if (!test) return { data: null, error: new Error('Test record not found') }

  store.tests = store.tests.filter((t) => t.id !== testId)

  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  store.audit_logs.unshift({
    id: `audit-del-test-${Date.now()}`,
    entity_id: entityId,
    action: `Deleted test record ${test.test_name}`,
    field_name: 'test',
    old_value: `${test.value} ${test.unit || ''} (${test.result})`,
    new_value: null,
    performed_by_name: userName,
    created_at: now,
  })

  saveLocalStore(store)
  return getEntity(entityId)
}

// ------------------------------------------------------------------------------
// PROCESS / LIFECYCLE
// ------------------------------------------------------------------------------

export async function addProcess(entityId, { processName, specification, remarks }, user) {
  const store = getLocalStore()
  const entity = store.entities.find((e) => e.id === entityId)
  if (!entity) return { data: null, error: new Error('Entity not found') }

  const cleanName = String(processName).trim()
  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  const processRecord = {
    id: `proc-${Date.now()}`,
    entity_id: entityId,
    process_name: cleanName,
    specification: specification?.trim() || '',
    remarks: remarks?.trim() || '',
    performed_by_name: userName,
    performed_at: now,
    created_at: now,
  }

  store.processes.push(processRecord)

  store.audit_logs.unshift({
    id: `audit-proc-${Date.now()}`,
    entity_id: entityId,
    action: `Added process: ${cleanName}`,
    field_name: 'process',
    old_value: null,
    new_value: specification || cleanName,
    performed_by_name: userName,
    created_at: now,
  })

  entity.updated_at = now
  saveLocalStore(store)
  return getEntity(entityId)
}

// ------------------------------------------------------------------------------
// EVIDENCE & ATTACHMENTS
// ------------------------------------------------------------------------------

export async function addEvidence(entityId, { fileName, fileSize, mimeType, fileDataUrl, processId = null }, user) {
  const store = getLocalStore()
  const entity = store.entities.find((e) => e.id === entityId)
  if (!entity) return { data: null, error: new Error('Entity not found') }

  const now = new Date().toISOString()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator'

  const evidence = {
    id: `ev-${Date.now()}`,
    entity_id: entityId,
    process_id: processId,
    file_name: fileName,
    file_size: fileSize || 1024,
    mime_type: mimeType || 'application/octet-stream',
    storage_path: fileDataUrl || `local/${entity.batch_id}/${fileName}`,
    uploaded_by_name: userName,
    created_at: now,
  }

  store.evidence.unshift(evidence)

  store.audit_logs.unshift({
    id: `audit-ev-${Date.now()}`,
    entity_id: entityId,
    action: `Uploaded evidence attachment: ${fileName}`,
    field_name: 'evidence',
    old_value: null,
    new_value: fileName,
    performed_by_name: userName,
    created_at: now,
  })

  entity.updated_at = now
  saveLocalStore(store)
  return getEntity(entityId)
}

// ------------------------------------------------------------------------------
// GLOBAL SEARCH & AUDIT
// ------------------------------------------------------------------------------

export async function searchTrace(query) {
  const q = String(query).trim().toLowerCase()
  if (!q) return []

  const store = getLocalStore()
  const results = []

  for (const entity of store.entities) {
    let matchType = null
    let matchDetail = ''

    if (entity.batch_id.toLowerCase().includes(q)) {
      matchType = 'Batch ID'
      matchDetail = `Matches Batch ID "${entity.batch_id}"`
    } else if (entity.supplier && entity.supplier.toLowerCase().includes(q)) {
      matchType = 'Supplier'
      matchDetail = `Supplier: ${entity.supplier}`
    } else if (entity.treatment && entity.treatment.toLowerCase().includes(q)) {
      matchType = 'Treatment'
      matchDetail = `Treatment: ${entity.treatment}`
    } else if (entity.notes && entity.notes.toLowerCase().includes(q)) {
      matchType = 'Remarks'
      matchDetail = entity.notes
    } else {
      // Check parameters
      const params = store.parameters.filter((p) => p.entity_id === entity.id)
      const matchedParam = params.find(
        (p) => p.name.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)
      )
      if (matchedParam) {
        matchType = 'Parameter'
        matchDetail = `${matchedParam.name}: ${matchedParam.value} ${matchedParam.unit || ''}`
      }
    }

    if (matchType) {
      const genealogy = resolveGenealogy(entity, store)
      results.push({
        entity,
        matchType,
        matchDetail,
        genealogy,
      })
    }
  }

  return results
}

export async function getGlobalAuditLogs(limit = 25) {
  const store = getLocalStore()
  const logs = [...store.audit_logs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map((log) => {
      const entity = store.entities.find((e) => e.id === log.entity_id)
      return {
        ...log,
        batch_id: entity?.batch_id || 'Unknown',
        entity_type: entity?.type || 'unknown',
      }
    })
  return logs
}
