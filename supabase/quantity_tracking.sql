-- Quantity tracking foundation for existing Namah Trace installations.
-- Apply after supabase/schema.sql.

create or replace function public.guard_entity_quantity_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_consumed numeric;
  v_has_unknown boolean;
begin
  if new.quantity is not null and (
    new.quantity < 0 or new.quantity::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Recorded quantity must be finite and non-negative.';
  end if;
  if new.quantity is not null and nullif(btrim(new.unit), '') is null then
    raise exception 'A unit is required when a recorded quantity is set.';
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  if new.type is distinct from old.type
     and exists (
       select 1
       from public.entity_genealogy g
       where g.parent_entity_id = old.id or g.child_entity_id = old.id
     ) then
    raise exception 'Batch type cannot be changed while genealogy relationships exist.';
  end if;

  if new.quantity is not distinct from old.quantity
     and new.unit is not distinct from old.unit then
    return new;
  end if;

  select
    coalesce(bool_or(
      g.quantity_used is null
      or g.quantity_used < 0
      or g.quantity_used::text in ('NaN', 'Infinity', '-Infinity')
      or nullif(btrim(g.unit), '') is null
    ), false),
    coalesce(sum(g.quantity_used), 0)
  into v_has_unknown, v_consumed
  from public.entity_genealogy g
  where g.parent_entity_id = old.id;

  if v_has_unknown then
    raise exception 'Quantity or unit cannot be changed while historical downstream consumption is unknown.';
  end if;

  if exists (
    select 1
    from public.entity_genealogy g
    where g.parent_entity_id = old.id
      and g.unit is distinct from old.unit
  ) then
    raise exception 'Recorded unit cannot be changed while downstream allocations exist.';
  end if;

  if new.quantity is null and v_consumed > 0 then
    raise exception 'Recorded quantity cannot be cleared while material is allocated downstream.';
  end if;
  if new.quantity is not null and new.quantity < v_consumed then
    raise exception 'Recorded quantity cannot be less than downstream consumed quantity (%).', v_consumed;
  end if;
  if new.unit is distinct from old.unit
     and exists (
       select 1 from public.entity_genealogy g where g.parent_entity_id = old.id
     ) then
    raise exception 'Recorded unit cannot be changed while downstream allocations exist.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_entity_quantity_update on public.entities;
create trigger guard_entity_quantity_update
before insert or update of quantity, unit, type on public.entities
for each row execute function public.guard_entity_quantity_update();

create or replace function public.create_batch_with_consumption(
  p_entity jsonb,
  p_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_child public.entities%rowtype;
  v_child_type text;
  v_quantity numeric;
  v_parent_ids uuid[];
  v_parent public.entities%rowtype;
  v_allocation jsonb;
  v_allocation_count integer;
  v_consumed numeric;
  v_unknown boolean;
  v_requested_quantity numeric;
  v_requested_unit text;
begin
  if v_user_id is null then
    raise exception 'An authenticated user is required to create material allocations.';
  end if;

  if jsonb_typeof(p_entity) <> 'object' then
    raise exception 'Entity data must be a JSON object.';
  end if;
  if jsonb_typeof(p_allocations) is distinct from 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise exception 'At least one material allocation is required.';
  end if;

  v_child_type := p_entity->>'type';
  if v_child_type is null or v_child_type not in ('yarn', 'rope') then
    raise exception 'Only Yarn and Rope batches can consume parent material.';
  end if;
  if nullif(btrim(p_entity->>'batch_id'), '') is null then
    raise exception 'Batch ID is required.';
  end if;

  v_quantity := nullif(p_entity->>'quantity', '')::numeric;
  if v_quantity is not null and (
    v_quantity < 0 or v_quantity::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Recorded quantity must be finite and non-negative.';
  end if;
  if v_quantity is not null and nullif(btrim(p_entity->>'unit'), '') is null then
    raise exception 'A unit is required when a recorded quantity is set.';
  end if;

  select
    array_agg(distinct (allocation->>'parent_entity_id')::uuid order by (allocation->>'parent_entity_id')::uuid),
    count(*)
  into v_parent_ids, v_allocation_count
  from jsonb_array_elements(p_allocations) as allocations(allocation);

  if coalesce(array_length(v_parent_ids, 1), 0) <> v_allocation_count then
    raise exception 'A parent batch may only be allocated once per child batch.';
  end if;
  if v_child_type = 'yarn' and v_allocation_count <> 1 then
    raise exception 'A Yarn Batch must have exactly one Flat Yarn parent.';
  end if;

  -- Lock all parents in deterministic order before reading their allocations.
  perform e.id
  from public.entities e
  where e.id = any(v_parent_ids)
  order by e.id
  for update;

  if (select count(*) from public.entities e where e.id = any(v_parent_ids))
     <> v_allocation_count then
    raise exception 'One or more selected parent batches do not exist.';
  end if;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    select e.* into v_parent
    from public.entities e
    where e.id = (v_allocation->>'parent_entity_id')::uuid;

    if (v_child_type = 'yarn' and v_parent.type <> 'flat_yarn')
       or (v_child_type = 'rope' and v_parent.type <> 'yarn') then
      raise exception 'Parent batch type is not valid for the requested child batch type.';
    end if;

    v_requested_quantity := nullif(v_allocation->>'quantity_used', '')::numeric;
    v_requested_unit := nullif(btrim(v_allocation->>'unit'), '');
    if v_requested_quantity is null or v_requested_quantity <= 0
       or v_requested_quantity::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Each material allocation must have a positive quantity.';
    end if;
    if v_requested_unit is null then
      raise exception 'Each material allocation must have a unit.';
    end if;
    if v_parent.quantity is null or nullif(btrim(v_parent.unit), '') is null then
      raise exception 'Parent batch % has no recorded quantity and unit.', v_parent.batch_id;
    end if;
    if v_parent.quantity < 0
       or v_parent.quantity::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Parent batch % has an invalid recorded quantity.', v_parent.batch_id;
    end if;
    if v_requested_unit <> v_parent.unit then
      raise exception 'Allocation unit must match parent batch % unit (%).', v_parent.batch_id, v_parent.unit;
    end if;

    select
      coalesce(bool_or(
        g.quantity_used is null
        or g.quantity_used < 0
        or g.quantity_used::text in ('NaN', 'Infinity', '-Infinity')
        or nullif(btrim(g.unit), '') is null
      ), false),
      coalesce(sum(g.quantity_used), 0)
    into v_unknown, v_consumed
    from public.entity_genealogy g
    where g.parent_entity_id = v_parent.id;

    if v_unknown then
      raise exception 'Available quantity for parent batch % is unknown because of historical allocations.', v_parent.batch_id;
    end if;
    if exists (
      select 1
      from public.entity_genealogy g
      where g.parent_entity_id = v_parent.id
        and g.unit is distinct from v_parent.unit
    ) then
      raise exception 'Existing allocation units for parent batch % do not match its recorded unit.', v_parent.batch_id;
    end if;
    if v_consumed + v_requested_quantity > v_parent.quantity then
      raise exception 'Insufficient quantity in parent batch %: available %, requested % %.',
        v_parent.batch_id,
        v_parent.quantity - v_consumed,
        v_requested_quantity,
        v_parent.unit;
    end if;
  end loop;

  insert into public.entities (
    type,
    batch_id,
    treatment,
    quantity,
    unit,
    status,
    notes,
    created_by
  ) values (
    v_child_type,
    btrim(p_entity->>'batch_id'),
    nullif(btrim(p_entity->>'treatment'), ''),
    v_quantity,
    nullif(btrim(p_entity->>'unit'), ''),
    coalesce(nullif(p_entity->>'status', ''), 'In Progress'),
    nullif(p_entity->>'notes', ''),
    v_user_id
  )
  returning * into v_child;

  for v_allocation in select value from jsonb_array_elements(p_allocations)
  loop
    select e.* into v_parent
    from public.entities e
    where e.id = (v_allocation->>'parent_entity_id')::uuid;
    v_requested_quantity := (v_allocation->>'quantity_used')::numeric;
    v_requested_unit := btrim(v_allocation->>'unit');

    insert into public.entity_genealogy (
      parent_entity_id,
      child_entity_id,
      quantity_used,
      unit,
      remarks
    ) values (
      v_parent.id,
      v_child.id,
      v_requested_quantity,
      v_requested_unit,
      nullif(btrim(v_allocation->>'remarks'), '')
    );

    insert into public.entity_audit_logs (
      entity_id, action, field_name, old_value, new_value, performed_by
    ) values
    (
      v_child.id,
      format('Created %s Batch %s from %s Batch %s',
        initcap(v_child_type), v_child.batch_id,
        initcap(v_parent.type), v_parent.batch_id),
      'genealogy_consumption',
      null,
      format('Input from %s: %s %s', v_parent.batch_id, v_requested_quantity, v_requested_unit),
      v_user_id
    ),
    (
      v_parent.id,
      format('Material allocated to %s Batch %s',
        initcap(v_child_type), v_child.batch_id),
      'genealogy_consumption',
      null,
      format('%s %s consumed by %s Batch %s',
        v_requested_quantity, v_requested_unit, initcap(v_child_type), v_child.batch_id),
      v_user_id
    );
  end loop;

  return v_child.id;
end;
$$;

drop policy if exists "Authenticated users can manage genealogy" on public.entity_genealogy;
drop policy if exists "Authenticated users can manage entities" on public.entities;
drop policy if exists "Authenticated users can create entities" on public.entities;
drop policy if exists "Authenticated users can update entities" on public.entities;
create policy "Authenticated users can create entities"
  on public.entities for insert to authenticated with check (true);
create policy "Authenticated users can update entities"
  on public.entities for update to authenticated using (true) with check (true);

revoke all on function public.create_batch_with_consumption(jsonb, jsonb) from public, anon;
grant execute on function public.create_batch_with_consumption(jsonb, jsonb) to authenticated;

revoke all on function public.guard_entity_quantity_update() from public, anon, authenticated;
