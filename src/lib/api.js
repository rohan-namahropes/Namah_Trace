import { supabase } from './supabase'

export async function listBatches() {
  return supabase
    .from('batches')
    .select('*, batch_stages(*, workflow_stages(*), stage_measurements(*), evidence(*))')
    .order('created_at', { ascending: false })
}

export async function getBatch(batchId) {
  return supabase
    .from('batches')
    .select('*, batch_stages(*, workflow_stages(*), stage_measurements(*), evidence(*))')
    .eq('id', batchId)
    .single()
}

export async function createBatch(batch, userId) {
  const created = await supabase
    .from('batches')
    .insert({ id: batch.id, notes: batch.notes, created_by: userId })
    .select()
    .single()
  if (created.error) return created

  const workflowStages = await supabase
    .from('workflow_stages')
    .select('id, position')
    .eq('is_active', true)
    .order('position', { ascending: true })
  if (workflowStages.error) return workflowStages
  if (!workflowStages.data?.length) {
    return { data: null, error: new Error('No active workflow stages are configured.') }
  }

  const stages = await supabase.from('batch_stages').insert(
    workflowStages.data.map((stage, index) => ({
      batch_id: batch.id,
      stage_id: stage.id,
      status: index === 0 ? 'In Progress' : 'Pending',
      started_at: index === 0 ? new Date().toISOString() : null,
    })),
  )
  if (stages.error) return stages
  return getBatch(batch.id)
}

export async function updateStageRecord(stageId, updates, userId) {
  return supabase
    .from('batch_stages')
    .update({
      status: updates.status,
      performed_by: userId,
      started_at: updates.startedAt,
      completed_at: updates.completedAt,
      notes: updates.notes,
    })
    .eq('id', stageId)
    .select()
    .single()
}

export async function replaceMeasurements(batchStageId, measurements) {
  const removed = await supabase
    .from('stage_measurements')
    .delete()
    .eq('batch_stage_id', batchStageId)
  if (removed.error) return removed
  if (!measurements.length) return { data: [], error: null }
  return supabase.from('stage_measurements').insert(
    measurements.map((measurement) => ({
      batch_stage_id: batchStageId,
      field_name: measurement.key,
      field_value: measurement.value,
    })),
  )
}

export async function uploadEvidence(file, batchId, batchStageId, userId) {
  const storagePath = `${batchId}/${batchStageId || 'batch'}/${crypto.randomUUID()}-${file.name}`
  const upload = await supabase.storage.from('evidence').upload(storagePath, file)
  if (upload.error) return upload
  const record = await supabase
    .from('evidence')
    .insert({ batch_id: batchId, batch_stage_id: batchStageId || null, file_name: file.name, storage_path: storagePath, mime_type: file.type, uploaded_by: userId })
    .select()
    .single()
  if (record.error) await supabase.storage.from('evidence').remove([storagePath])
  return record
}

export async function updateBatchStatus(batchId, status) {
  return supabase.from('batches').update({ status }).eq('id', batchId).select().single()
}

export async function saveStageRecord(batchId, stageId, updates, userId) {
  const stage = await updateStageRecord(stageId, updates, userId)
  if (stage.error) return stage

  const measurements = await replaceMeasurements(stageId, updates.measurements || [])
  if (measurements.error) return measurements

  for (const file of updates.evidenceFiles || []) {
    const evidence = await uploadEvidence(file, batchId, stageId, userId)
    if (evidence.error) return evidence
  }

  const allStages = await supabase
    .from('batch_stages')
    .select('status')
    .eq('batch_id', batchId)
  if (allStages.error) return allStages
  const status = updates.status === 'On Hold'
    ? 'On Hold'
    : allStages.data.every((item) => item.status === 'Completed')
      ? 'Completed'
      : 'In Progress'
  const batch = await updateBatchStatus(batchId, status)
  if (batch.error) return batch
  return getBatch(batchId)
}
