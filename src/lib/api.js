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

function mapGenealogy(entity, entities, links, balanceLinks = links) {
  const byId = new Map(entities.map((item) => [item.id, item]))
  const treeEdges = links
    .filter((link) => byId.has(link.parent_entity_id) && byId.has(link.child_entity_id))
    .map((link) => {
      const parent = byId.get(link.parent_entity_id)
      const child = byId.get(link.child_entity_id)
      const parentBalance = quantityBalance(parent, balanceLinks)
      const childBalance = quantityBalance(child, balanceLinks)
      return {
        id: link.id,
        parentId: parent.id,
        parentBatchId: parent.batch_id,
        parentType: parent.type,
        parentUnit: parent.unit,
        parentRemaining: parentBalance.quantityRemaining,
        parentRemainingKnown: parentBalance.consumptionKnown,
        childId: child.id,
        childBatchId: child.batch_id,
        childType: child.type,
        childUnit: child.unit,
        childRemaining: childBalance.quantityRemaining,
        childRemainingKnown: childBalance.consumptionKnown,
        quantityUsed: link.quantity_used,
        unit: link.unit,
      }
    })
    .sort((left, right) => (
      left.parentBatchId.localeCompare(right.parentBatchId)
      || left.childBatchId.localeCompare(right.childBatchId)
    ))
  const parents = links
    .filter((link) => link.child_entity_id === entity.id)
    .map((link) => {
      const parent = byId.get(link.parent_entity_id)
      const balance = parent ? quantityBalance(parent, balanceLinks) : null
      return {
        linkId: link.id,
        entityId: link.parent_entity_id,
        batchId: parent?.batch_id || 'Unknown',
        type: parent?.type || 'unknown',
        supplier: parent?.supplier || null,
        treatment: parent?.treatment || null,
        quantityUsed: link.quantity_used,
        unit: link.unit || parent?.unit,
        quantityRemaining: balance?.quantityRemaining ?? null,
        remainingKnown: balance?.consumptionKnown ?? false,
        quantityUnit: parent?.unit || null,
        remarks: link.remarks,
      }
    })
  const children = links
    .filter((link) => link.parent_entity_id === entity.id)
    .map((link) => {
      const child = byId.get(link.child_entity_id)
      const balance = child ? quantityBalance(child, balanceLinks) : null
      return {
        linkId: link.id,
        entityId: link.child_entity_id,
        batchId: child?.batch_id || 'Unknown',
        type: child?.type || 'unknown',
        treatment: child?.treatment || null,
        quantityUsed: link.quantity_used,
        unit: link.unit || byId.get(link.parent_entity_id)?.unit,
        quantityRemaining: balance?.quantityRemaining ?? null,
        remainingKnown: balance?.consumptionKnown ?? false,
        quantityUnit: child?.unit || null,
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
  return { parents, grandparents, children, grandchildren, treeEdges }
}

function quantityBalance(entity, links) {
  const outgoing = links.filter((link) => link.parent_entity_id === entity.id)
  const startingQuantity = entity.quantity ?? (
    entity.type === 'yarn' ? entity.estimated_output_quantity : null
  )
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
  const balanceKnown = startingQuantity != null && Boolean(unit) && consumptionKnown
  return {
    quantityConsumed: consumptionKnown ? consumed : null,
    quantityRemaining: balanceKnown ? Number(startingQuantity) - consumed : null,
    consumptionKnown: balanceKnown,
  }
}

function hasComparableCriticalThreshold(entity) {
  return entity.critical_quantity_threshold != null
    && Number.isFinite(Number(entity.critical_quantity_threshold))
    && Number(entity.critical_quantity_threshold) >= 0
    && Boolean(entity.unit?.trim())
    && Boolean(entity.critical_quantity_threshold_unit?.trim())
    && entity.unit === entity.critical_quantity_threshold_unit
}

async function entityBundle(entityId, knownEntity = null) {
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
    knownEntity
      ? Promise.resolve(knownEntity)
      : queryData(db.from('entities').select('*').eq('id', entityId).maybeSingle()),
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
  const ancestorIds = new Set([entityId])
  const descendantIds = new Set([entityId])
  let expanded = true
  while (expanded) {
    expanded = false
    for (const link of allGenealogyLinks) {
      if (ancestorIds.has(link.child_entity_id) && !ancestorIds.has(link.parent_entity_id)) {
        ancestorIds.add(link.parent_entity_id)
        expanded = true
      }
      if (descendantIds.has(link.parent_entity_id) && !descendantIds.has(link.child_entity_id)) {
        descendantIds.add(link.child_entity_id)
        expanded = true
      }
    }
  }
  const lineageLinks = allGenealogyLinks.filter((link) => (
    (ancestorIds.has(link.parent_entity_id) && ancestorIds.has(link.child_entity_id))
    || (descendantIds.has(link.parent_entity_id) && descendantIds.has(link.child_entity_id))
  ))
  const balance = quantityBalance(entity, allGenealogyLinks)
  const lowStock = entity.type === 'flat_yarn'
    && hasComparableCriticalThreshold(entity)
    && balance.quantityRemaining != null
    && balance.quantityRemaining < Number(entity.critical_quantity_threshold)
  const stockDepleted = balance.quantityRemaining != null && balance.quantityRemaining <= 0
  const thresholdUnitProblem = entity.type === 'flat_yarn'
    && entity.critical_quantity_threshold != null
    && (
      !entity.unit?.trim()
      || !entity.critical_quantity_threshold_unit?.trim()
      || entity.unit !== entity.critical_quantity_threshold_unit
    )
  const peopleIds = [
    entity.created_by,
    ...tests.map((item) => item.performed_by),
    ...processes.map((item) => item.performed_by),
    ...evidenceRows.map((item) => item.uploaded_by),
    ...auditLogs.map((item) => item.performed_by),
    ...relatedEntities.map((item) => item.created_by),
  ]
  const profiles = await fetchProfiles(peopleIds)
  const processLookup = new Map(processes.map((item) => [item.id, item]))
  const parameterLookup = new Map(parameters.map((item) => [item.id, item]))
  const testLookup = new Map(tests.map((item) => [item.id, item]))
  const evidence = evidenceRows.map((item) => ({
    ...item,
    uploaded_by_name: profiles.get(item.uploaded_by) || null,
    process_name: item.process_id ? processLookup.get(item.process_id)?.process_name || null : null,
    parameter_name: item.parameter_id ? parameterLookup.get(item.parameter_id)?.name || null : null,
    test_name: item.test_id ? testLookup.get(item.test_id)?.test_name || null : null,
  }))
  return {
    ...entity,
    ...balance,
    lowStock,
    stockDepleted,
    thresholdUnitProblem,
    created_by_name: profiles.get(entity.created_by) || null,
    parameters,
    tests: tests.map((item) => ({
      ...item,
      process_name: item.process_id ? processLookup.get(item.process_id)?.process_name || null : null,
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
    genealogy: mapGenealogy(entity, [entity, ...relatedEntities], lineageLinks, allGenealogyLinks),
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

export async function listDismissedStockAlerts(userId) {
  return withResult(async () => {
    const rows = await queryData(
      requireSupabase().from('user_dismissed_stock_alerts')
        .select('entity_id')
        .eq('user_id', userId)
    )
    return rows.map((row) => row.entity_id)
  })
}

export async function dismissStockAlerts(userId, entityIds) {
  return withResult(async () => {
    if (entityIds.length === 0) return []
    const rows = entityIds.map((entityId) => ({ user_id: userId, entity_id: entityId }))
    return queryData(
      requireSupabase().from('user_dismissed_stock_alerts')
        .upsert(rows, { onConflict: 'user_id,entity_id', ignoreDuplicates: true })
        .select('entity_id')
    )
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
    return enrichEntities(entities.map((entity) => {
      const balance = quantityBalance(entity, links)
      const lowStock = entity.type === 'flat_yarn'
        && hasComparableCriticalThreshold(entity)
        && balance.quantityRemaining != null
        && balance.quantityRemaining < Number(entity.critical_quantity_threshold)
      const stockDepleted = balance.quantityRemaining != null && balance.quantityRemaining <= 0
      const thresholdUnitProblem = entity.type === 'flat_yarn'
        && entity.critical_quantity_threshold != null
        && (
          !entity.unit?.trim()
          || !entity.critical_quantity_threshold_unit?.trim()
          || entity.unit !== entity.critical_quantity_threshold_unit
        )
      return {
        ...entity,
        ...balance,
        lowStock,
        stockDepleted,
        thresholdUnitProblem,
      }
    }))
  })
}

export async function getEntity(idOrBatchId) {
  return withResult(async () => {
    const entity = await findEntity(idOrBatchId)
    if (!entity) throw new Error('Entity not found')
    const data = await entityBundle(entity.id, entity)
    if (!data) throw new Error('Entity not found')
    return data
  })
}

export async function createFlatYarn({
  batchId: requestedBatchIdInput,
  supplier,
  quantity,
  unit = 'kg',
  criticalQuantityThreshold = null,
  criticalQuantityThresholdUnit = unit,
  notes,
}) {
  return withResult(async () => {
    const db = requireSupabase()
    const supplierName = String(supplier || '').trim()
    const requestedBatchId = String(requestedBatchIdInput || '').trim()
    const batchId = requestedBatchId || [
      'INTAKE',
      supplierName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'COMPANY',
      new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      crypto.randomUUID().slice(0, 12).toUpperCase(),
    ].join('-')
    if (requestedBatchId.toUpperCase().startsWith('INTAKE-')) {
      throw new Error('Batch IDs starting with INTAKE- are reserved for temporary intake records.')
    }
    if (criticalQuantityThreshold != null && (
      !Number.isFinite(Number(criticalQuantityThreshold))
      || Number(criticalQuantityThreshold) < 0
      || criticalQuantityThresholdUnit !== unit
    )) {
      throw new Error('Critical stock threshold must be finite, non-negative, and use the batch stock unit.')
    }
    const entity = await queryData(db.from('entities').insert({
      type: 'flat_yarn',
      batch_id: batchId,
      supplier: supplierName || null,
      quantity: quantity == null || quantity === '' ? null : Number(quantity),
      unit: unit || 'kg',
      critical_quantity_threshold: criticalQuantityThreshold,
      critical_quantity_threshold_unit: criticalQuantityThreshold == null ? null : criticalQuantityThresholdUnit,
      status: 'In Progress',
      notes: notes?.trim() || '',
    }).select().single())
    try {
      await writeAuditLog(
        entity.id,
        requestedBatchId
          ? `Created Flat Yarn Batch ${entity.batch_id}`
          : `Created Flat Yarn Intake ${entity.batch_id}`,
        { field_name: 'creation', new_value: `Supplier: ${supplierName || 'None'}` }
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
  wastagePercentage = 3.5,
  unit = 'kg',
  remarks,
}) {
  return withResult(async () => {
    const db = requireSupabase()
    if (!inputQuantity || Number(inputQuantity) <= 0) {
      throw new Error('Quantity consumed from the Flat Yarn parent is required.')
    }
    const percentage = Number(wastagePercentage)
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error('Wastage percentage must be between 0 and 100.')
    }
    const entityId = await queryData(db.rpc('create_yarn_batch_with_consumption', {
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
      p_wastage_percentage: percentage,
    }))
    return {
      id: entityId,
      type: 'yarn',
      batch_id: String(batchId).trim(),
      estimated_output_quantity: inputUnit === unit
        ? Number(inputQuantity) * (100 - percentage) / 100
        : null,
      wastage_percentage: percentage,
    }
  })
}

export async function listYarnConfigurations() {
  return withResult(async () => {
    const db = requireSupabase()
    return queryData(
      db.from('yarn_configurations').select('*').order('name')
    )
  })
}

export async function saveYarnConfiguration({ name, suffix, twistingDenier, plyingConfiguration }) {
  return withResult(async () => {
    const trimmedName = String(name || '').trim()
    const trimmedSuffix = String(suffix || '').trim()
    const denier = String(twistingDenier || '').trim()
    if (!trimmedName || !denier) {
      throw new Error('Configuration name and twisting denier are required.')
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(trimmedSuffix)) {
      throw new Error('Suffix must start with a letter or number and contain only letters, numbers, hyphens, or underscores.')
    }
    const db = requireSupabase()
    return queryData(
      db.from('yarn_configurations').insert({
        name: trimmedName,
        suffix: trimmedSuffix,
        twisting_denier: denier,
        plying_configuration: String(plyingConfiguration || '').trim(),
      }).select().single()
    )
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
    const allowed = [
      'batch_id',
      'supplier',
      'treatment',
      'quantity',
      'unit',
      'estimated_output_quantity',
      'wastage_percentage',
      'critical_quantity_threshold',
      'critical_quantity_threshold_unit',
      'notes',
    ]
    const changes = Object.fromEntries(
      allowed.filter((field) => field in updates).map((field) => [field, updates[field]])
    )
    if ('batch_id' in changes) {
      const batchId = String(changes.batch_id || '').trim()
      if (current.type !== 'flat_yarn' || !batchId) {
        throw new Error('A non-empty Flat Yarn batch ID is required.')
      }
      if (batchId.toUpperCase().startsWith('INTAKE-')) {
        throw new Error('Batch IDs starting with INTAKE- are reserved for temporary intake records.')
      }
      changes.batch_id = batchId
    }
    if (
      current.type === 'flat_yarn'
      && changes.critical_quantity_threshold != null
    ) {
      if (
        !Number.isFinite(Number(changes.critical_quantity_threshold))
        || Number(changes.critical_quantity_threshold) < 0
      ) {
        throw new Error('Critical stock threshold must be a finite, non-negative quantity.')
      }
      const stockUnit = changes.unit ?? current.unit
      const thresholdUnit = changes.critical_quantity_threshold_unit ?? current.critical_quantity_threshold_unit
      if (!stockUnit || !thresholdUnit || stockUnit !== thresholdUnit) {
        throw new Error('Critical stock threshold unit must match the batch stock unit.')
      }
    }
    if (changes.wastage_percentage != null) {
      const percentage = Number(changes.wastage_percentage)
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        throw new Error('Wastage percentage must be between 0 and 100.')
      }
    }
    if (changes.estimated_output_quantity != null) {
      const estimate = Number(changes.estimated_output_quantity)
      if (!Number.isFinite(estimate) || estimate < 0) {
        throw new Error('Estimated output must be a finite, non-negative quantity.')
      }
    }
    const auditEvents = []
    const fieldLabels = {
      batch_id: 'Batch ID',
      estimated_output_quantity: 'Estimated output',
      wastage_percentage: 'Wastage percentage',
      critical_quantity_threshold: 'Critical stock threshold',
      critical_quantity_threshold_unit: 'Critical threshold unit',
    }
    for (const field of allowed) {
      if (!(field in changes) || changes[field] === current[field]) continue
      const oldValue = current[field] == null ? '' : String(current[field])
      const newValue = changes[field] == null ? '' : String(changes[field])
      auditEvents.push({
        entityId,
        action: field === 'notes'
          ? 'Updated notes / remarks'
          : `${fieldLabels[field] || `${field[0].toUpperCase()}${field.slice(1)}`} changed from "${oldValue || 'None'}" to "${newValue || 'None'}"`,
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

export async function addTest(entityId, {
  testName,
  value,
  unit,
  productCategory,
  applicableStandard,
  remarks,
  result = 'Pass',
  processId = null,
}) {
  return withResult(async () => {
    const db = requireSupabase()
    const test = await queryData(db.from('entity_tests').insert({
      entity_id: entityId,
      process_id: processId || null,
      test_name: String(testName).trim(),
      value: String(value).trim(),
      unit: unit?.trim() || '',
      product_category: productCategory?.trim() || null,
      applicable_standard: applicableStandard?.trim() || null,
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

export async function addEvidence(entityId, {
  file,
  fileName,
  fileSize,
  processId = null,
  parameterId = null,
  testId = null,
}) {
  return withResult(async () => {
    const db = requireSupabase()
    if (!file) throw new Error('Select a file to upload.')
    if (file.size > 25 * 1024 * 1024) throw new Error('Evidence files must be 25 MB or smaller.')
    const extension = String(file.name || fileName || '').split('.').pop().toLowerCase()
    const mimeByExtension = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
    }
    const resolvedMimeType = mimeByExtension[extension]
    if (!resolvedMimeType || (file.type && file.type !== resolvedMimeType && file.type !== 'application/octet-stream')) {
      throw new Error('Supported evidence types are PDF, JPG, PNG, DOCX, MP4, MOV, and WebM.')
    }
    if ([processId, parameterId, testId].filter(Boolean).length > 1) {
      throw new Error('Evidence can be linked to only one record at a time.')
    }
    const entity = await queryData(db.from('entities').select('id').eq('id', entityId).maybeSingle())
    if (!entity) throw new Error('Entity not found')
    const storagePath = `${entityId}/${crypto.randomUUID()}`
    const storage = db.storage.from(EVIDENCE_BUCKET)
    const { error: uploadError } = await storage.upload(storagePath, file, {
      contentType: resolvedMimeType,
      upsert: false,
    })
    if (uploadError) throw uploadError
    let evidence
    try {
      evidence = await queryData(db.from('entity_evidence').insert({
        entity_id: entityId,
        process_id: processId,
        parameter_id: parameterId,
        test_id: testId,
        file_name: fileName || file.name,
        file_size: fileSize ?? file.size,
        mime_type: resolvedMimeType,
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
      const linkDescription = testId
        ? `test ${testId}`
        : parameterId
          ? `parameter ${parameterId}`
          : processId
            ? `process ${processId}`
            : 'batch'
      await writeAuditLog(
        entityId,
        `Uploaded evidence attachment: ${evidence.file_name} (${linkDescription})`,
        {
          field_name: 'evidence',
          new_value: evidence.file_name,
          linked_record: linkDescription,
        }
      )
    } catch (error) {
      throw committedAuditError(error)
    }

    return evidence
  })
}

export async function getEvidenceDownloadUrl(entityId, evidenceId) {
  return withResult(async () => {
    const db = requireSupabase()
    const evidence = await queryData(
      db.from('entity_evidence')
        .select('*')
        .eq('id', evidenceId)
        .eq('entity_id', entityId)
        .maybeSingle()
    )
    if (!evidence || !evidence.storage_path) {
      throw new Error('Evidence attachment not found.')
    }

    const { data, error } = await db.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(evidence.storage_path, 3600)

    if (error) throw error
    if (!data?.signedUrl) throw new Error('Unable to create a filtered download link for this file.')
    return data.signedUrl
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
