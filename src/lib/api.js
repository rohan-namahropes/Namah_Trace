import { supabase } from './supabase'

export async function listBatches() {
  return supabase.from('batches').select('*, batch_stages(*, workflow_stages(*), stage_measurements(*), evidence(*))').order('created_at', { ascending: false })
}

export async function createBatch(batch, userId) {
  return supabase.from('batches').insert({ id: batch.id, notes: batch.notes, created_by: userId }).select().single()
}

export async function updateStageRecord(stageId, updates) {
  return supabase.from('batch_stages').update({ status: updates.status, performed_by: updates.performedBy, started_at: updates.startedAt, completed_at: updates.completedAt, notes: updates.notes }).eq('id', stageId)
}

export async function addMeasurement(batchStageId, fieldName, fieldValue) {
  return supabase.from('stage_measurements').insert({ batch_stage_id: batchStageId, field_name: fieldName, field_value: fieldValue })
}

export async function uploadEvidence(file, batchId, batchStageId, userId) {
  const storagePath = `${batchId}/${batchStageId || 'batch'}/${crypto.randomUUID()}-${file.name}`
  const upload = await supabase.storage.from('evidence').upload(storagePath, file)
  if (upload.error) return upload
  return supabase.from('evidence').insert({ batch_id: batchId, batch_stage_id: batchStageId || null, file_name: file.name, storage_path: storagePath, mime_type: file.type, uploaded_by: userId })
}
