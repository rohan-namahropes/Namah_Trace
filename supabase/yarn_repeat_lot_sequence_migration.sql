-- Assign a unique, sequential production-lot ID to every Yarn run.
-- The readable batch ID provided by the client is treated as the lot base;
-- the database assigns the sequence while holding a transaction-level lock.
begin;

create or replace function public.create_yarn_batch_with_consumption(
  p_entity jsonb,
  p_allocations jsonb,
  p_wastage_percentage numeric
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_entity_id uuid;
  v_input_quantity numeric;
  v_input_unit text;
  v_output_unit text;
  v_estimated_output_quantity numeric;
  v_base_batch_id text;
  v_generated_batch_id text;
  v_next_sequence numeric;
  v_max_sequence numeric;
  v_matching_runs bigint;
  v_parent_entity_id uuid;
  v_entity jsonb;
begin
  if not public.current_user_has_permission('produce') then
    raise exception 'Production access is required to create a Yarn batch.';
  end if;

  if jsonb_typeof(p_entity) is distinct from 'object' then
    raise exception 'Yarn batch data must be a JSON object.';
  end if;

  if jsonb_typeof(p_allocations) is distinct from 'array'
     or jsonb_array_length(p_allocations) <> 1 then
    raise exception 'A Yarn batch requires exactly one Flat Yarn input allocation.';
  end if;

  v_base_batch_id := nullif(btrim(p_entity->>'batch_id'), '');
  if v_base_batch_id is null then
    raise exception 'Yarn lot base ID is required.';
  end if;
  v_parent_entity_id := nullif(p_allocations->0->>'parent_entity_id', '')::uuid;

  if p_wastage_percentage is null
     or p_wastage_percentage < 0
     or p_wastage_percentage > 100
     or p_wastage_percentage::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Wastage percentage must be between 0 and 100.';
  end if;

  -- The second key is a stable lock namespace; hash collisions only serialize
  -- unrelated specifications and cannot produce duplicate lot sequences.
  perform pg_advisory_xact_lock(42001, hashtext(v_base_batch_id));

  select coalesce(
    max(substring(e.batch_id from char_length(v_base_batch_id) + 2)::numeric),
    0
  )
  into v_max_sequence
  from public.entities e
  where e.type = 'yarn'
    and left(e.batch_id, char_length(v_base_batch_id) + 1) = v_base_batch_id || '-'
    and substring(e.batch_id from char_length(v_base_batch_id) + 2) ~ '^[0-9]+$';

  select count(*)
  into v_matching_runs
  from public.entities e
  where e.type = 'yarn'
    and e.treatment is not distinct from nullif(btrim(p_entity->>'treatment'), '')
    and e.denier is not distinct from nullif(btrim(p_entity->>'denier'), '')
    and e.twist_direction is not distinct from nullif(btrim(p_entity->>'twist_direction'), '')
    and e.twist_direction_other is not distinct from nullif(btrim(p_entity->>'twist_direction_other'), '')
    and exists (
      select 1
      from public.entity_genealogy g
      where g.child_entity_id = e.id
        and g.parent_entity_id = v_parent_entity_id
    );

  v_next_sequence := greatest(v_max_sequence, v_matching_runs) + 1;
  if v_next_sequence > 2147483647 then
    raise exception 'Yarn lot sequence is exhausted for base ID %.', v_base_batch_id;
  end if;

  v_generated_batch_id := v_base_batch_id || '-' || lpad(v_next_sequence::text, 2, '0');
  v_entity := jsonb_set(p_entity, '{batch_id}', to_jsonb(v_generated_batch_id), true);

  v_input_quantity := nullif(btrim(p_allocations->0->>'quantity_used'), '')::numeric;
  v_input_unit := nullif(btrim(p_allocations->0->>'unit'), '');
  v_output_unit := nullif(btrim(p_entity->>'unit'), '');
  if v_input_unit is not null and v_input_unit = v_output_unit then
    v_estimated_output_quantity := v_input_quantity * (100 - p_wastage_percentage) / 100;
  end if;

  v_entity_id := public.create_batch_with_consumption(v_entity, p_allocations);

  update public.entities
  set wastage_percentage = p_wastage_percentage,
      estimated_output_quantity = v_estimated_output_quantity,
      denier = nullif(btrim(v_entity->>'denier'), ''),
      twist_direction = nullif(btrim(v_entity->>'twist_direction'), ''),
      twist_direction_other = nullif(btrim(v_entity->>'twist_direction_other'), ''),
      yarn_category = nullif(btrim(v_entity->>'yarn_category'), ''),
      occurred_at = nullif(btrim(v_entity->>'occurred_at'), '')::timestamptz
  where id = v_entity_id;

  if not found then
    raise exception 'Created Yarn batch could not be updated with its estimate.';
  end if;

  insert into public.entity_audit_logs (entity_id, action, details, performed_by)
  values (
    v_entity_id,
    'Recorded Yarn wastage estimate',
    jsonb_build_object(
      'field_name', 'wastage_estimate',
      'wastage_percentage', p_wastage_percentage,
      'estimated_output_quantity', v_estimated_output_quantity
    ),
    auth.uid()
  );

  insert into public.entity_audit_logs (entity_id, action, details, performed_by)
  values (
    v_entity_id,
    format('Assigned Yarn lot sequence %s', v_next_sequence),
    jsonb_build_object(
      'field_name', 'yarn_lot_sequence',
      'lot_base_id', v_base_batch_id,
      'lot_sequence', v_next_sequence,
      'generated_batch_id', v_generated_batch_id
    ),
    auth.uid()
  );

  return v_entity_id;
end;
$$;

revoke all on function public.create_yarn_batch_with_consumption(jsonb, jsonb, numeric)
  from public, anon, authenticated;
grant execute on function public.create_yarn_batch_with_consumption(jsonb, jsonb, numeric)
  to authenticated;

commit;
