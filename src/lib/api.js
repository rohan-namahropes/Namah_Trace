import { supabase } from './supabase'

export async function listBatches() {
  const batches = await supabase
    .from('batches')
    .select('*, batch_stages(*, workflow_stages(*), stage_measurements(*), evidence(*)), batch_history(*)')
    .order('created_at', { ascending: false })
  if (batches.error) return batches
  return attachProfiles(batches.data)
}

export async function getBatch(batchId) {
  const batch = await supabase
    .from('batches')
    .select('*, batch_stages(*, workflow_stages(*), stage_measurements(*), evidence(*)), batch_history(*)')
    .eq('id', batchId)
    .single()
  if (batch.error) return batch
  return attachProfiles([batch.data]).then(({ data, error }) => ({
    data: data?.[0] || null,
    error,
  }))
}

async function attachProfiles(batches) {
  const profiles = await supabase.from('profiles').select('id, display_name')
  if (profiles.error) return profiles
  const names = new Map((profiles.data || []).map((profile) => [profile.id, profile.display_name]))
  return {
    data: batches.map((batch) => ({
      ...batch,
      creator_name: names.get(batch.created_by) || null,
      batch_history: (batch.batch_history || []).map((event) => ({
        ...event,
        actor_name: names.get(event.performed_by) || null,
      })),
      batch_stages: (batch.batch_stages || []).map((stage) => ({
        ...stage,
        performer_name: names.get(stage.performed_by) || null,
      })),
    })),
    error: null,
  }
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

  const history = await supabase.from('batch_history').insert({
    batch_id: batchId,
    batch_stage_id: stageId,
    action: updates.status === 'Completed' ? 'Stage completed' : 'Stage updated',
    status: updates.status,
    notes: updates.notes,
    performed_by: userId,
  })
  if (history.error) return history
  return getBatch(batchId)
}
