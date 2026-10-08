import { supabase } from './supabase'

const EVIDENCE_BUCKET = 'evidence'

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Configure the project URL and anon key to use Namah Trace.')
  }
  return supabase
}

async function queryData(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

async function fetchProfiles(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  const rows = await queryData(
    requireSupabase().from('profiles').select('id, display_name').in('id', ids)
  )
  return new Map(rows.map((profile) => [profile.id, profile.display_name]))
}

async function writeAuditLog(entityId, action, details = null) {
  const db = requireSupabase()
  return queryData(
    db.from('entity_audit_logs').insert({
      entity_id: entityId,
      action,
      details,
    }).select().single()
  )
}

async function writeAuditLogs(events) {
  if (events.length === 0) return
  const db = requireSupabase()
  const rows = events.map(({ entityId, action, fieldName, oldValue, newValue }) => ({
    entity_id: entityId,
    action,
    details: {
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
    },
  }))
  await queryData(db.from('entity_audit_logs').insert(rows))
}

function withAuditDisplayFields(log) {
  const details = log.details && typeof log.details === 'object' && !Array.isArray(log.details)
    ? log.details
    : {}
  let newValue = details.new_value ?? details.newValue ?? null

  if (newValue == null && details.quantity_used != null) {
    newValue = `${details.quantity_used} ${details.unit || ''}`.trim()
  }
  if (
    newValue == null
    && details.old_value == null
    && details.oldValue == null
    && Object.keys(details).length > 0
  ) {
    newValue = JSON.stringify(details)
  }
  if (newValue != null && typeof newValue !== 'string') {
    newValue = JSON.stringify(newValue)
  }

  return {
    ...log,
    field_name: details.field_name ?? details.fieldName ?? null,
    old_value: details.old_value ?? details.oldValue ?? null,
    new_value: newValue,
  }
}

function committedAuditError(error) {
  const message = error instanceof Error ? error.message : String(error)
  const committedError = new Error(
    `The operational change was saved, but its audit entry could not be saved: ${message}`
  )
  committedError.operationCommitted = true
  return committedError
}

async function findEntity(idOrBatchId) {
  const db = requireSupabase()
  const value = String(idOrBatchId)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    const byId = await queryData(
      db.from('entities').select('*').eq('id', value).maybeSingle()
    )
    if (byId) return byId
  }
  return queryData(
    db.from('entities').select('*').ilike('batch_id', value).maybeSingle()
  )
}

async function enrichEntities(entities) {
  if (entities.length === 0) return entities
  const profiles = await fetchProfiles(entities.map((entity) => entity.created_by))
  return entities.map((entity) => ({
    ...entity,
    created_by_name: profiles.get(entity.created_by) || null,
  }))
}

function mapGenealogy(entity, entities, links) {
  const byId = new Map(entities.map((item) => [item.id, item]))
  const parents = links
    .filter((link) => link.child_entity_id === entity.id)
    .map((link) => {
      const parent = byId.get(link.parent_entity_id)
      return {
        linkId: link.id,
        entityId: link.parent_entity_id,
        batchId: parent?.batch_id || 'Unknown',
        type: parent?.type || 'unknown',
        supplier: parent?.supplier || null,
        treatment: parent?.treatment || null,
        quantityUsed: link.quantity_used,
        unit: link.unit || parent?.unit,
        remarks: link.remarks,
      }
    })
  const children = links
    .filter((link) => link.parent_entity_id === entity.id)
    .map((link) => {
      const child = byId.get(link.child_entity_id)
      return {
        linkId: link.id,
        entityId: link.child_entity_id,
        batchId: child?.batch_id || 'Unknown',
        type: child?.type || 'unknown',
        treatment: child?.treatment || null,
        quantityUsed: link.quantity_used,
        unit: link.unit || byId.get(link.parent_entity_id)?.unit,
        status: child?.status,
        remarks: link.remarks,
      }
    })

  const grandparents = []
  if (entity.type === 'rope') {
    for (const parent of parents) {
      for (const link of links.filter((item) => item.child_entity_id === parent.entityId)) {
        const grandparent = byId.get(link.parent_entity_id)
        if (grandparent && !grandparents.some((item) => item.entityId === grandparent.id)) {
          grandparents.push({
            entityId: grandparent.id,
            batchId: grandparent.batch_id,
            type: grandparent.type,
            supplier: grandparent.supplier,
            viaYarnBatch: parent.batchId,
          })
        }
      }
    }
  }

  const grandchildren = []
  if (entity.type === 'flat_yarn') {
    for (const child of children) {
      for (const link of links.filter((item) => item.parent_entity_id === child.entityId)) {
        const grandchild = byId.get(link.child_entity_id)
        if (grandchild && !grandchildren.some((item) => item.entityId === grandchild.id)) {
          grandchildren.push({
            entityId: grandchild.id,
            batchId: grandchild.batch_id,
            type: grandchild.type,
            status: grandchild.status,
            viaYarnBatch: child.batchId,
          })
        }
      }
    }
  }
  return { parents, grandparents, children, grandchildren }
}

function quantityBalance(entity, links) {
  const outgoing = links.filter((link) => link.parent_entity_id === entity.id)
  const hasUnknownAllocation = outgoing.some(
    (link) => link.quantity_used == null
      || !link.unit
      || !Number.isFinite(Number(link.quantity_used))
      || Number(link.quantity_used) <= 0
  )
  const consumed = hasUnknownAllocation
    ? null
    : outgoing.reduce((sum, link) => sum + Number(link.quantity_used), 0)
  const unit = entity.unit || null
  const unitsMatch = outgoing.every((link) => link.unit === unit)
  const consumptionKnown = !hasUnknownAllocation && unitsMatch
  const balanceKnown = entity.quantity != null && Boolean(unit) && consumptionKnown
  return {
    quantityConsumed: consumptionKnown ? consumed : null,
    quantityRemaining: balanceKnown ? Number(entity.quantity) - consumed : null,
    consumptionKnown: balanceKnown,
  }
}

async function entityBundle(entityId) {
  const db = requireSupabase()
  const [
    entity,
    parameters,
    tests,
    processes,
    evidenceRows,
    auditLogs,
    genealogyLinks,
  ] = await Promise.all([
    queryData(db.from('entities').select('*').eq('id', entityId).maybeSingle()),
    queryData(db.from('entity_parameters').select('*').eq('entity_id', entityId).order('created_at')),
    queryData(db.from('entity_tests').select('*').eq('entity_id', entityId).order('created_at')),
    queryData(db.from('entity_processes').select('*').eq('entity_id', entityId).order('performed_at')),
    queryData(db.from('entity_evidence').select('*').eq('entity_id', entityId).order('created_at', { ascending: false })),
    queryData(db.from('entity_audit_logs').select('*').eq('entity_id', entityId).order('created_at', { ascending: false })),
    queryData(db.from('entity_genealogy').select('*').or(`parent_entity_id.eq.${entityId},child_entity_id.eq.${entityId}`)),
  ])
  if (!entity) return null

  const adjacentIds = [...new Set(genealogyLinks.flatMap((link) => [
    link.parent_entity_id,
    link.child_entity_id,
  ]))]
  const adjacentLinks = adjacentIds.length
    ? await Promise.all([
      queryData(db.from('entity_genealogy').select('*').in('parent_entity_id', adjacentIds)),
      queryData(db.from('entity_genealogy').select('*').in('child_entity_id', adjacentIds)),
    ])
    : []
  const allGenealogyLinks = [...new Map(
    [...genealogyLinks, ...adjacentLinks.flat()].map((link) => [link.id, link])
  ).values()]
  const relatedIds = [...new Set(allGenealogyLinks.flatMap((link) => [
    link.parent_entity_id,
    link.child_entity_id,
  ]))]
  const relatedEntities = relatedIds.length
    ? await queryData(db.from('entities').select('*').in('id', relatedIds))
    : []
  const balance = quantityBalance(entity, allGenealogyLinks)
  const peopleIds = [
    entity.created_by,
    ...tests.map((item) => item.performed_by),
    ...processes.map((item) => item.performed_by),
    ...evidenceRows.map((item) => item.uploaded_by),
    ...auditLogs.map((item) => item.performed_by),
    ...relatedEntities.map((item) => item.created_by),
  ]
  const profiles = await fetchProfiles(peopleIds)
  const evidence = await Promise.all(evidenceRows.map(async (item) => {
    let storagePath = ''
    if (item.storage_path) {
      const { data, error } = await db.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(item.storage_path, 3600)
      if (error) throw error
      if (!data?.signedUrl) throw new Error(`Unable to create a download link for ${item.file_name}.`)
      storagePath = data.signedUrl
    }
    return {
      ...item,
      uploaded_by_name: profiles.get(item.uploaded_by) || null,
      storage_path: storagePath,
    }
  }))
  return {
    ...entity,
    ...balance,
    created_by_name: profiles.get(entity.created_by) || null,
    parameters,
    tests: tests.map((item) => ({
      ...item,
      performed_by_name: profiles.get(item.performed_by) || null,
    })),
    processes: processes.map((item) => ({
      ...item,
      performed_by_name: profiles.get(item.performed_by) || null,
    })),
    evidence,
    auditLogs: auditLogs.map((item) => ({
      ...withAuditDisplayFields(item),
      performed_by_name: profiles.get(item.performed_by) || null,
    })),
    genealogy: mapGenealogy(entity, [entity, ...relatedEntities], allGenealogyLinks),
  }
}

async function withResult(callback) {
  try {
    return { data: await callback(), error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getCurrentUserProfile(userId) {
  return withResult(async () => {
    const profile = await queryData(
      requireSupabase()
        .from('profiles')
        .select('id, display_name, role')
        .eq('id', userId)
        .maybeSingle()
    )
    if (!profile) throw new Error('Your user profile is not provisioned.')
    return profile
  })
}

export async function checkSupabaseAvailable() {
  const db = requireSupabase()
  await queryData(db.from('entities').select('id').limit(1))
  return true
}

export function getStorageMode() {
  return 'supabase'
}

export async function listEntities(type = null) {
  return withResult(async () => {
    const db = requireSupabase()
    let query = db.from('entities').select('*').order('created_at', { ascending: false })
    if (type) query = query.eq('type', type)
    const entities = await queryData(query)
    const links = entities.length
      ? await queryData(
        db.from('entity_genealogy')
          .select('parent_entity_id, quantity_used, unit')
          .in('parent_entity_id', entities.map((entity) => entity.id))
      )
      : []
    return enrichEntities(entities.map((entity) => ({
      ...entity,
      ...quantityBalance(entity, links),
    })))
  })
}

export async function getEntity(idOrBatchId) {
  return withResult(async () => {
    const entity = await findEntity(idOrBatchId)
    if (!entity) throw new Error('Entity not found')
    const data = await entityBundle(entity.id)
    if (!data) throw new Error('Entity not found')
    return data
  })
}

export async function createFlatYarn({ batchId, supplier, quantity, unit = 'kg', notes }) {
  return withResult(async () => {
    const db = requireSupabase()
    const entity = await queryData(db.from('entities').insert({
      type: 'flat_yarn',
      batch_id: String(batchId).trim(),
      supplier: supplier?.trim() || null,
      quantity: quantity == null || quantity === '' ? null : Number(quantity),
      unit: unit || 'kg',
      status: 'In Progress',
      notes: notes?.trim() || '',
    }).select().single())
    try {
      await writeAuditLog(
        entity.id,
        `Created Flat Yarn Batch ${entity.batch_id}`,
        { field_name: 'creation', new_value: `Supplier: ${supplier || 'None'}` }
      )
    } catch (error) {
      throw committedAuditError(error)
    }
    return entity
  })
}

export async function createYarnBatch({
  batchId,
  parentEntityId,
  treatment,
  inputQuantity,
  inputUnit,
  quantity,
  unit = 'kg',
  remarks,
}) {
  return withResult(async () => {
    const db = requireSupabase()
    if (!inputQuantity || Number(inputQuantity) <= 0) {
      throw new Error('Quantity consumed from the Flat Yarn parent is required.')
    }
    const entityId = await queryData(db.rpc('create_batch_with_consumption', {
      p_entity: {
        type: 'yarn',
        batch_id: String(batchId).trim(),
        treatment: treatment?.trim() || null,
        quantity: quantity == null || quantity === '' ? null : Number(quantity),
        unit: unit || 'kg',
        status: 'In Progress',
        notes: remarks?.trim() || '',
      },
      p_allocations: [{
        parent_entity_id: parentEntityId,
        quantity_used: Number(inputQuantity),
        unit: inputUnit,
        remarks: remarks?.trim() || null,
      }],
    }))
    return { id: entityId, type: 'yarn', batch_id: String(batchId).trim() }
  })
}

export async function createRopeBatch({ batchId, allocations, quantity, unit = 'meters', notes }) {
  return withResult(async () => {
    const db = requireSupabase()
    if (!allocations?.length) throw new Error('At least one parent Yarn Batch must be selected.')
    const entityId = await queryData(db.rpc('create_batch_with_consumption', {
      p_entity: {
        type: 'rope',
        batch_id: String(batchId).trim(),
        quantity: quantity == null || quantity === '' ? null : Number(quantity),
        unit: unit || 'meters',
        status: 'In Progress',
        notes: notes?.trim() || '',
      },
      p_allocations: allocations.map((allocation) => ({
        parent_entity_id: allocation.parentEntityId,
        quantity_used: Number(allocation.quantity),
        unit: allocation.unit,
        remarks: allocation.remarks || null,
      })),
    }))
    return { id: entityId, type: 'rope', batch_id: String(batchId).trim() }
  })
}

export async function updateEntityBasicInfo(entityId, updates) {
  return withResult(async () => {
    const db = requireSupabase()
    const current = await queryData(db.from('entities').select('*').eq('id', entityId).maybeSingle())
    if (!current) throw new Error('Entity not found')
    const allowed = ['supplier', 'treatment', 'quantity', 'unit', 'notes']
    const changes = Object.fromEntries(
      allowed.filter((field) => field in updates).map((field) => [field, updates[field]])
    )
    const auditEvents = []
    for (const field of allowed) {
      if (!(field in changes) || changes[field] === current[field]) continue
      const oldValue = current[field] == null ? '' : String(current[field])
      const newValue = changes[field] == null ? '' : String(changes[field])
      auditEvents.push({
        entityId,
        action: field === 'notes'
          ? 'Updated notes / remarks'
          : `${field[0].toUpperCase()}${field.slice(1)} changed from "${oldValue || 'None'}" to "${newValue || 'None'}"`,
        fieldName: field,
        oldValue,
        newValue,
      })
    }
    changes.updated_at = new Date().toISOString()
    const updated = await queryData(
      db.from('entities').update(changes).eq('id', entityId).select().single()
    )
    try {
      await writeAuditLogs(auditEvents)
    } catch (error) {
      throw committedAuditError(error)
    }
    return updated
  })
}

export async function updateEntityStatus(entityId, newStatus) {
  return withResult(async () => {
    const db = requireSupabase()
    const current = await queryData(db.from('entities').select('*').eq('id', entityId).maybeSingle())
    if (!current) throw new Error('Entity not found')
    const updated = await queryData(db.from('entities').update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', entityId).select().single())
    if (current.status !== newStatus) {
      await writeAuditLog(
        entityId,
        `Status changed from "${current.status || 'Not Set'}" to "${newStatus || 'Not Set'}"`,
        {
          field_name: 'status',
          old_value: current.status || 'Not Set',
          new_value: newStatus || 'Not Set',
        }
      )
        .catch((error) => {
          throw committedAuditError(error)
        })
    }
    return updated
  })
}

export async function addParameter(entityId, { name, value, unit, remarks }) {
  return withResult(async () => {
    const db = requireSupabase()
    const parameter = await queryData(db.from('entity_parameters').insert({
      entity_id: entityId,
      name: String(name).trim(),
      value: String(value).trim(),
      unit: unit?.trim() || '',
      remarks: remarks?.trim() || '',
    }).select().single())
    try {
      await writeAuditLog(
        entityId,
        `Added parameter ${parameter.name}`,
        {
          field_name: 'parameter',
          new_value: `${parameter.value} ${parameter.unit || ''}`.trim(),
        }
      )
    } catch (error) {
      throw committedAuditError(error)
    }
    return parameter
  })
}

export async function deleteParameter(entityId, paramId) {
  return withResult(async () => {
    const db = requireSupabase()
    const parameter = await queryData(
      db.from('entity_parameters').select('*').eq('id', paramId).eq('entity_id', entityId).maybeSingle()
    )
    if (!parameter) throw new Error('Parameter not found')
    await queryData(
      db.from('entity_parameters')
        .delete()
        .eq('id', paramId)
        .eq('entity_id', entityId)
        .select('id')
        .single()
    )
    await writeAuditLog(
      entityId,
      `Removed parameter ${parameter.name}`,
      {
        field_name: 'parameter',
        old_value: `${parameter.value} ${parameter.unit || ''}`.trim(),
      }
    ).catch((error) => {
      throw committedAuditError(error)
    })
    return { id: paramId }
  })
}

export async function addTest(entityId, { testName, value, unit, remarks, result = 'Pass' }) {
  return withResult(async () => {
    const db = requireSupabase()
    const test = await queryData(db.from('entity_tests').insert({
      entity_id: entityId,
      test_name: String(testName).trim(),
      value: String(value).trim(),
      unit: unit?.trim() || '',
      result: result || 'Pass',
      remarks: remarks?.trim() || '',
    }).select().single())
    try {
      await writeAuditLog(
        entityId,
        `Recorded test: ${test.test_name}`,
        {
          field_name: 'test',
          new_value: `${test.value} ${test.unit || ''} [${test.result}]`.trim(),
        }
      )
    } catch (error) {
      throw committedAuditError(error)
    }
    return test
  })
}

export async function deleteTest(entityId, testId) {
  return withResult(async () => {
    const db = requireSupabase()
    const test = await queryData(
      db.from('entity_tests').select('*').eq('id', testId).eq('entity_id', entityId).maybeSingle()
    )
    if (!test) throw new Error('Test record not found')
    await queryData(
      db.from('entity_tests')
        .delete()
        .eq('id', testId)
        .eq('entity_id', entityId)
        .select('id')
        .single()
    )
    await writeAuditLog(
      entityId,
      `Deleted test record ${test.test_name}`,
      {
        field_name: 'test',
        old_value: `${test.value} ${test.unit || ''} (${test.result})`,
      }
    ).catch((error) => {
      throw committedAuditError(error)
    })
    return { id: testId }
  })
}

export async function addProcess(entityId, { processName, specification, remarks }) {
  return withResult(async () => {
    const db = requireSupabase()
    const process = await queryData(db.from('entity_processes').insert({
      entity_id: entityId,
      process_name: String(processName).trim(),
      specification: specification?.trim() || '',
      remarks: remarks?.trim() || '',
    }).select().single())
    try {
      await writeAuditLog(
        entityId,
        `Added process: ${process.process_name}`,
        {
          field_name: 'process',
          new_value: process.specification || process.process_name,
        }
      )
    } catch (error) {
      throw committedAuditError(error)
    }
    return process
  })
}

export async function addEvidence(entityId, { file, fileName, fileSize, mimeType, processId = null }) {
  return withResult(async () => {
    const db = requireSupabase()
    if (!file) throw new Error('Select a file to upload.')
    const entity = await queryData(db.from('entities').select('id').eq('id', entityId).maybeSingle())
    if (!entity) throw new Error('Entity not found')
    const storagePath = `${entityId}/${crypto.randomUUID()}`
    const storage = db.storage.from(EVIDENCE_BUCKET)
    const { error: uploadError } = await storage.upload(storagePath, file, {
      contentType: mimeType || file.type || 'application/octet-stream',
      upsert: false,
    })
    if (uploadError) throw uploadError
    let evidence
    try {
      evidence = await queryData(db.from('entity_evidence').insert({
        entity_id: entityId,
        process_id: processId,
        file_name: fileName || file.name,
        file_size: fileSize ?? file.size,
        mime_type: mimeType || file.type || 'application/octet-stream',
        storage_path: storagePath,
      }).select().single())
    } catch (error) {
      const { error: cleanupError } = await storage.remove([storagePath])
      if (cleanupError) {
        throw new Error(`${error.message}; uploaded file cleanup also failed: ${cleanupError.message}`)
      }
      throw error
    }

    try {
      await writeAuditLog(
        entityId,
        `Uploaded evidence attachment: ${evidence.file_name}`,
        { field_name: 'evidence', new_value: evidence.file_name }
      )
    } catch (error) {
      throw committedAuditError(error)
    }

    return evidence
  })
}

export async function searchTrace(query) {
  const q = String(query).trim().toLowerCase()
  if (!q) return []
  const db = requireSupabase()
  const [entities, parameters] = await Promise.all([
    queryData(db.from('entities').select('*').order('created_at', { ascending: false })),
    queryData(db.from('entity_parameters').select('*')),
  ])
  const parameterEntities = new Set(
    parameters
      .filter((item) => item.name.toLowerCase().includes(q) || item.value.toLowerCase().includes(q))
      .map((item) => item.entity_id)
  )
  const results = []
  for (const entity of entities) {
    let matchType = null
    let matchDetail = ''
    if (entity.batch_id.toLowerCase().includes(q)) {
      matchType = 'Batch ID'
      matchDetail = `Matches Batch ID "${entity.batch_id}"`
    } else if (entity.supplier?.toLowerCase().includes(q)) {
      matchType = 'Supplier'
      matchDetail = `Supplier: ${entity.supplier}`
    } else if (entity.treatment?.toLowerCase().includes(q)) {
      matchType = 'Treatment'
      matchDetail = `Treatment: ${entity.treatment}`
    } else if (entity.notes?.toLowerCase().includes(q)) {
      matchType = 'Remarks'
      matchDetail = entity.notes
    } else if (parameterEntities.has(entity.id)) {
      matchType = 'Parameter'
      const parameter = parameters.find(
        (item) => item.entity_id === entity.id &&
          (item.name.toLowerCase().includes(q) || item.value.toLowerCase().includes(q))
      )
      matchDetail = `${parameter.name}: ${parameter.value} ${parameter.unit || ''}`
    }
    if (matchType) {
      results.push({
        entity,
        matchType,
        matchDetail,
        genealogy: (await entityBundle(entity.id)).genealogy,
      })
    }
  }
  return results
}

export async function getGlobalAuditLogs(limit = 25) {
  const db = requireSupabase()
  const logs = await queryData(
    db.from('entity_audit_logs').select('*').order('created_at', { ascending: false }).limit(limit)
  )
  const entityIds = [...new Set(logs.map((log) => log.entity_id))]
  const entities = entityIds.length
    ? await queryData(db.from('entities').select('id, batch_id, type').in('id', entityIds))
    : []
  const byEntity = new Map(entities.map((entity) => [entity.id, entity]))
  const profiles = await fetchProfiles(logs.map((log) => log.performed_by))
  return logs.map((log) => {
    const entity = byEntity.get(log.entity_id)
    return {
      ...withAuditDisplayFields(log),
      batch_id: entity?.batch_id || 'Unknown',
      entity_type: entity?.type || 'unknown',
      performed_by_name: profiles.get(log.performed_by) || null,
    }
  })
}
