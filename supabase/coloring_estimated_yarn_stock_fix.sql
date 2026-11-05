-- Apply after production_identity_access_migration.sql.
-- Allows coloring Yarn whose available balance is based on estimated output.
begin;

create or replace function public.create_colored_material_lot(
  p_parent_entity_id uuid,
  p_color text,
  p_quantity_used numeric,
  p_output_quantity numeric,
  p_unit text,
  p_occurred_at timestamptz,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_parent public.entities%rowtype;
  v_child_id uuid;
  v_base_id text;
  v_color_slug text;
  v_child_batch_id text;
  v_sequence numeric;
  v_parent_available numeric;
  v_consumed numeric;
  v_unknown boolean;
  v_previous_rpc_marker text;
  v_color text := nullif(btrim(p_color), '');
  v_unit text := nullif(btrim(p_unit), '');
begin
  if not public.current_user_has_permission('produce') then
    raise exception 'Production access is required to create a colored material lot.';
  end if;
  if v_color is null then
    raise exception 'Color is required.';
  end if;
  if char_length(v_color) > 80 then
    raise exception 'Color must be 80 characters or fewer.';
  end if;
  if p_quantity_used is null or p_quantity_used <= 0
     or p_quantity_used::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Consumed quantity must be finite and positive.';
  end if;
  if p_output_quantity is null or p_output_quantity < 0
     or p_output_quantity::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Output quantity must be finite and non-negative.';
  end if;
  if v_unit is null then
    raise exception 'A quantity unit is required.';
  end if;

  select * into v_parent
  from public.entities
  where id = p_parent_entity_id
  for update;
  if not found or v_parent.type not in ('flat_yarn', 'yarn') then
    raise exception 'Select an existing Flat Yarn or Yarn lot.';
  end if;

  v_parent_available := v_parent.quantity;
  if v_parent_available is null and v_parent.type = 'yarn' then
    v_parent_available := v_parent.estimated_output_quantity;
  end if;
  if v_parent_available is null or v_parent.unit is null
     or v_parent_available < 0
     or v_parent_available::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'The source lot must have a known quantity and unit.';
  end if;
  if v_parent.color is not null and lower(v_parent.color) = lower(v_color) then
    raise exception 'This source lot is already recorded as color %.', v_color;
  end if;
  if v_parent.unit <> v_unit then
    raise exception 'Consumed quantity unit must match source lot unit (%).', v_parent.unit;
  end if;

  select
    coalesce(bool_or(
      g.quantity_used is null
      or g.quantity_used <= 0
      or g.quantity_used::text in ('NaN', 'Infinity', '-Infinity')
      or g.unit is distinct from v_parent.unit
    ), false),
    coalesce(sum(g.quantity_used), 0)
  into v_unknown, v_consumed
  from public.entity_genealogy g
  where g.parent_entity_id = v_parent.id;
  if v_unknown then
    raise exception 'Source lot availability is unknown because of historical allocations.';
  end if;
  if p_quantity_used + v_consumed > v_parent_available then
    raise exception 'Insufficient source material: available %, requested % %.',
      v_parent_available - v_consumed, p_quantity_used, v_unit;
  end if;

  v_color_slug := coalesce(
    nullif(trim(both '-' from upper(regexp_replace(v_color, '[^A-Za-z0-9]+', '-', 'g'))), ''),
    'COLOR'
  );
  v_base_id := v_parent.batch_id || '-C-' || v_color_slug;
  perform pg_advisory_xact_lock(42002, hashtext(v_base_id));
  select coalesce(max(
    case
      when substring(e.batch_id from char_length(v_base_id) + 2) ~ '^[0-9]+$'
        then substring(e.batch_id from char_length(v_base_id) + 2)::numeric
      else null
    end
  ), 0) + 1
  into v_sequence
  from public.entities e
  where e.type = v_parent.type
    and left(e.batch_id, char_length(v_base_id) + 1) = v_base_id || '-';
  if v_sequence > 2147483647 then
    raise exception 'Color lot sequence is exhausted for base ID %.', v_base_id;
  end if;
  v_child_batch_id := v_base_id || '-' || lpad(v_sequence::text, 2, '0');

  v_previous_rpc_marker := current_setting('namah_trace.allocation_rpc', true);
  perform set_config('namah_trace.allocation_rpc', 'on', true);

  insert into public.entities (
    type, batch_id, supplier, treatment, denier, twist_direction,
    twist_direction_other, yarn_category, quantity, unit, status, notes,
    color, created_by, occurred_at
  )
  values (
    v_parent.type,
    v_child_batch_id,
    v_parent.supplier,
    v_parent.treatment,
    v_parent.denier,
    v_parent.twist_direction,
    v_parent.twist_direction_other,
    v_parent.yarn_category,
    p_output_quantity,
    v_unit,
    'In Progress',
    nullif(btrim(p_remarks), ''),
    v_color,
    auth.uid(),
    coalesce(p_occurred_at, now())
  )
  returning id into v_child_id;

  insert into public.entity_genealogy (
    parent_entity_id, child_entity_id, quantity_used, unit, remarks
  )
  values (v_parent.id, v_child_id, p_quantity_used, v_unit, nullif(btrim(p_remarks), ''));

  insert into public.entity_processes (
    entity_id, process_name, specification, remarks, performed_by, performed_at
  )
  values (
    v_child_id, 'Coloring', v_color, nullif(btrim(p_remarks), ''),
    auth.uid(), coalesce(p_occurred_at, now())
  );

  insert into public.entity_audit_logs (entity_id, action, details, performed_by)
  values (
    v_child_id,
    format('Created colored %s lot %s', initcap(v_parent.type), v_child_batch_id),
    jsonb_build_object(
      'event', 'color_lot_created',
      'parent_entity_id', v_parent.id,
      'parent_batch_id', v_parent.batch_id,
      'quantity_used', p_quantity_used,
      'output_quantity', p_output_quantity,
      'unit', v_unit,
      'color', v_color
    ),
    auth.uid()
  );

  perform set_config('namah_trace.allocation_rpc', coalesce(v_previous_rpc_marker, ''), true);
  return v_child_id;
end;
$$;

revoke all on function public.create_colored_material_lot(uuid, text, numeric, numeric, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.create_colored_material_lot(uuid, text, numeric, numeric, text, timestamptz, text)
  to authenticated;

commit;
