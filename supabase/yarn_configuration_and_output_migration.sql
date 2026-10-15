-- Named Yarn configurations and separate estimated-output/wastage fields.
-- The existing protected allocation RPC remains the authority for genealogy;
-- this wrapper stores production estimates in that same transaction.
begin;

alter table public.entities
  add column if not exists estimated_output_quantity numeric,
  add column if not exists wastage_percentage numeric;

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entities'::regclass
      and conname = 'entities_wastage_percentage_valid'
  ) then
    alter table public.entities
      add constraint entities_wastage_percentage_valid
      check (
        wastage_percentage is null
        or (
          wastage_percentage >= 0
          and wastage_percentage <= 100
          and wastage_percentage::text not in ('NaN', 'Infinity', '-Infinity')
        )
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entities'::regclass
      and conname = 'entities_estimated_output_valid'
  ) then
    alter table public.entities
      add constraint entities_estimated_output_valid
      check (
        estimated_output_quantity is null
        or (
          estimated_output_quantity >= 0
          and estimated_output_quantity::text not in ('NaN', 'Infinity', '-Infinity')
        )
      )
      not valid;
  end if;
end;
$migration$;

create table if not exists public.yarn_configurations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  suffix text not null,
  twisting_denier text not null,
  plying_configuration text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(btrim(name), '') is not null),
  check (suffix ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'),
  check (nullif(btrim(twisting_denier), '') is not null)
);

grant select, insert, update, delete on public.yarn_configurations to authenticated;

create index if not exists idx_yarn_configurations_name
  on public.yarn_configurations(name);

alter table public.yarn_configurations enable row level security;

drop policy if exists "Operational users can read Yarn configurations"
  on public.yarn_configurations;
drop policy if exists "Operational users can create Yarn configurations"
  on public.yarn_configurations;
drop policy if exists "Operational users can update Yarn configurations"
  on public.yarn_configurations;
drop policy if exists "Admins can delete Yarn configurations"
  on public.yarn_configurations;
drop policy if exists "Admins can manage Yarn configurations"
  on public.yarn_configurations;

create policy "Operational users can read Yarn configurations"
  on public.yarn_configurations for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Operational users can create Yarn configurations"
  on public.yarn_configurations for insert to authenticated
  with check (public.current_user_has_operational_access());
create policy "Operational users can update Yarn configurations"
  on public.yarn_configurations for update to authenticated
  using (public.current_user_has_operational_access())
  with check (public.current_user_has_operational_access());
create policy "Admins can delete Yarn configurations"
  on public.yarn_configurations for delete to authenticated
  using (public.current_user_is_admin());
create policy "Admins can manage Yarn configurations"
  on public.yarn_configurations for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop trigger if exists yarn_configurations_authenticated_actor
  on public.yarn_configurations;
create trigger yarn_configurations_authenticated_actor
before insert or update on public.yarn_configurations
for each row execute function public.enforce_authenticated_actor('created_by');

create or replace function public.create_yarn_batch_with_consumption(
  p_entity jsonb,
  p_allocations jsonb,
  p_wastage_percentage numeric
)
returns uuid
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_entity_id uuid;
  v_input_quantity numeric;
  v_input_unit text;
  v_output_unit text;
  v_estimated_output_quantity numeric;
begin
  if not public.current_user_has_operational_access() then
    raise exception 'Operational access is required to create a Yarn batch.';
  end if;

  if p_wastage_percentage is null
     or p_wastage_percentage < 0
     or p_wastage_percentage > 100
     or p_wastage_percentage::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Wastage percentage must be between 0 and 100.';
  end if;

  if jsonb_typeof(p_allocations) is distinct from 'array'
     or jsonb_array_length(p_allocations) <> 1 then
    raise exception 'A Yarn batch requires exactly one Flat Yarn input allocation.';
  end if;

  v_input_quantity := nullif(btrim(p_allocations->0->>'quantity_used'), '')::numeric;
  v_input_unit := nullif(btrim(p_allocations->0->>'unit'), '');
  v_output_unit := nullif(btrim(p_entity->>'unit'), '');
  if v_input_unit is not null and v_input_unit = v_output_unit then
    v_estimated_output_quantity := v_input_quantity * (100 - p_wastage_percentage) / 100;
  end if;

  v_entity_id := public.create_batch_with_consumption(p_entity, p_allocations);

  update public.entities
  set wastage_percentage = p_wastage_percentage,
      estimated_output_quantity = v_estimated_output_quantity
  where id = v_entity_id;

  if not found then
    raise exception 'Created Yarn batch could not be updated with its estimate.';
  end if;

  insert into public.entity_audit_logs (entity_id, action, details)
  values (
    v_entity_id,
    'Recorded Yarn wastage estimate',
    jsonb_build_object(
      'field_name', 'wastage_estimate',
      'wastage_percentage', p_wastage_percentage,
      'estimated_output_quantity', v_estimated_output_quantity
    )
  );

  return v_entity_id;
end;
$$;

revoke all on function public.create_yarn_batch_with_consumption(jsonb, jsonb, numeric)
  from public, anon, authenticated;
grant execute on function public.create_yarn_batch_with_consumption(jsonb, jsonb, numeric)
  to authenticated;

commit;
