-- Apply after schema.sql, authorization_v1.sql, and quantity_tracking_production.sql.
-- Adds event dates, yarn identity, sample labels, rope composition fields,
-- admin-managed process specifications, and audited batch-ID permissions.

begin;

alter table public.entities
  add column if not exists occurred_at timestamptz,
  add column if not exists denier text,
  add column if not exists twist_direction text,
  add column if not exists twist_direction_other text,
  add column if not exists yarn_category text,
  add column if not exists rope_grams_per_meter numeric,
  add column if not exists rope_target_length numeric;

update public.entities
set occurred_at = created_at
where occurred_at is null;

alter table public.entities
  alter column occurred_at set default now(),
  alter column occurred_at set not null;

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entities'::regclass
      and conname = 'entities_twist_direction_valid'
  ) then
    alter table public.entities
      add constraint entities_twist_direction_valid
      check (twist_direction is null or twist_direction in ('S', 'Z', 'Other'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entities'::regclass
      and conname = 'entities_rope_gpm_valid'
  ) then
    alter table public.entities
      add constraint entities_rope_gpm_valid
      check (
        rope_grams_per_meter is null
        or (
          rope_grams_per_meter > 0
          and rope_grams_per_meter::text not in ('NaN', 'Infinity', '-Infinity')
        )
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entities'::regclass
      and conname = 'entities_rope_length_valid'
  ) then
    alter table public.entities
      add constraint entities_rope_length_valid
      check (
        rope_target_length is null
        or (
          rope_target_length > 0
          and rope_target_length::text not in ('NaN', 'Infinity', '-Infinity')
        )
      )
      not valid;
  end if;

end;
$migration$;

alter table public.entity_tests
  add column if not exists sample_id text;

alter table public.entity_genealogy
  add column if not exists component_role text,
  add column if not exists composition_percentage numeric;

alter table public.entity_genealogy
  drop constraint if exists entity_genealogy_composition_valid;

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entity_genealogy'::regclass
      and conname = 'entity_genealogy_composition_valid'
  ) then
    alter table public.entity_genealogy
      add constraint entity_genealogy_composition_valid
      check (
        composition_percentage is null
        or (
          composition_percentage >= 0
          and composition_percentage <= 100
          and composition_percentage::text not in ('NaN', 'Infinity', '-Infinity')
        )
      )
      not valid;
  end if;
end;
$migration$;

create table if not exists public.process_type_specifications (
  id uuid primary key default gen_random_uuid(),
  process_family text not null,
  type_name text not null,
  specification_file_name text,
  specification_storage_path text,
  specification_mime_type text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(btrim(process_family), '') is not null),
  check (nullif(btrim(type_name), '') is not null),
  unique (process_family, type_name)
);

alter table public.process_type_specifications
  alter column specification_file_name drop not null,
  alter column specification_storage_path drop not null,
  alter column specification_mime_type drop not null;

alter table public.process_type_specifications enable row level security;
grant select, insert, update, delete on public.process_type_specifications to authenticated;

drop policy if exists "Operational users can read process type specifications"
  on public.process_type_specifications;
drop policy if exists "Admins can manage process type specifications"
  on public.process_type_specifications;

create policy "Operational users can read process type specifications"
  on public.process_type_specifications for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Admins can manage process type specifications"
  on public.process_type_specifications for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.track_process_specification_actor()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.track_process_specification_actor()
  from public, anon, authenticated;

drop trigger if exists track_process_specification_actor on public.process_type_specifications;
create trigger track_process_specification_actor
  before insert or update on public.process_type_specifications
  for each row execute function public.track_process_specification_actor();

alter table public.entity_processes
  add column if not exists process_family text,
  add column if not exists process_type text,
  add column if not exists process_type_specification_id uuid
  references public.process_type_specifications(id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'process-specifications',
  'process-specifications',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Operational users can read process specifications"
  on storage.objects;
drop policy if exists "Admins can manage process specifications"
  on storage.objects;

create policy "Operational users can read process specifications"
  on storage.objects for select to authenticated
  using (bucket_id = 'process-specifications' and public.current_user_has_operational_access());
create policy "Admins can manage process specifications"
  on storage.objects for all to authenticated
  using (bucket_id = 'process-specifications' and public.current_user_is_admin())
  with check (bucket_id = 'process-specifications' and public.current_user_is_admin());

create or replace function public.save_rope_composition_metadata(
  p_entity_id uuid,
  p_target_length numeric,
  p_grams_per_meter numeric,
  p_occurred_at timestamptz,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  rope_entity public.entities%rowtype;
  allocation_count integer;
  linked_parent_count integer;
  total_percentage numeric;
begin
  if auth.uid() is null or not public.current_user_has_operational_access() then
    raise exception 'Operational access is required to save Rope composition.';
  end if;

  select * into rope_entity
  from public.entities
  where id = p_entity_id
  for update;

  if not found then
    raise exception 'Rope batch was not found.';
  end if;
  if rope_entity.type <> 'rope' then
    raise exception 'Rope batch was not found.';
  end if;

  if (p_target_length is null) <> (p_grams_per_meter is null) then
    raise exception 'Target length and grams per meter must both be provided or both be empty.';
  end if;
  if p_target_length is not null and (
    p_target_length <= 0
    or p_target_length::text in ('NaN', 'Infinity', '-Infinity')
    or p_grams_per_meter <= 0
    or p_grams_per_meter::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Target length and grams per meter must be finite positive values.';
  end if;
  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Rope allocations must be an array.';
  end if;

  select count(*), coalesce(sum((allocation->>'composition_percentage')::numeric), 0)
  into allocation_count, total_percentage
  from jsonb_array_elements(p_allocations) as items(allocation);

  if allocation_count = 0 or abs(total_percentage - 100) > 0.000001 then
    raise exception 'Yarn component percentages must total 100%%.';
  end if;
  if (
    select count(distinct allocation->>'parent_entity_id')
    from jsonb_array_elements(p_allocations) as items(allocation)
  ) <> allocation_count then
    raise exception 'A parent Yarn batch can only appear once in Rope composition.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_allocations) as items(allocation)
    where nullif(btrim(allocation->>'component_role'), '') is null
      or nullif(allocation->>'parent_entity_id', '') is null
      or (allocation->>'composition_percentage')::numeric <= 0
      or (allocation->>'composition_percentage')::numeric > 100
      or (allocation->>'composition_percentage')::numeric::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Each Yarn allocation requires a component role and a positive composition percentage.';
  end if;

  select count(*)
  into linked_parent_count
  from jsonb_array_elements(p_allocations) as items(allocation)
  join public.entity_genealogy genealogy
    on genealogy.parent_entity_id = (allocation->>'parent_entity_id')::uuid
   and genealogy.child_entity_id = p_entity_id
  join public.entities parent
    on parent.id = genealogy.parent_entity_id
   and parent.type = 'yarn';

  if linked_parent_count <> allocation_count then
    raise exception 'Every composition allocation must match a linked parent Yarn batch.';
  end if;
  if p_target_length is not null and exists (
    select 1
    from jsonb_array_elements(p_allocations) as items(allocation)
    join public.entity_genealogy genealogy
      on genealogy.parent_entity_id = (allocation->>'parent_entity_id')::uuid
     and genealogy.child_entity_id = p_entity_id
    where lower(coalesce(btrim(genealogy.unit), '')) not in ('kg', 'lbs')
      or abs(
        genealogy.quantity_used
        - (
          p_target_length * p_grams_per_meter / 1000
          * (allocation->>'composition_percentage')::numeric / 100
          * case lower(btrim(genealogy.unit))
            when 'kg' then 1
            when 'lbs' then 2.2046226218
            else 0
          end
        )
      ) > greatest(
        0.000001,
        p_target_length * p_grams_per_meter / 1000
          * (allocation->>'composition_percentage')::numeric / 100
          * case lower(btrim(genealogy.unit))
            when 'kg' then 1
            when 'lbs' then 2.2046226218
            else 0
          end * 0.000001
      )
  ) then
    raise exception 'Rope material allocations do not match the target length, grams per meter, and composition shares.';
  end if;

  update public.entities
  set rope_target_length = p_target_length,
      rope_grams_per_meter = p_grams_per_meter,
      occurred_at = coalesce(p_occurred_at, occurred_at)
  where id = p_entity_id;

  perform set_config('namah_trace.allocation_rpc', 'on', true);

  update public.entity_genealogy genealogy
  set component_role = btrim(allocation->>'component_role'),
      composition_percentage = (allocation->>'composition_percentage')::numeric
  from jsonb_array_elements(p_allocations) as items(allocation)
  where genealogy.child_entity_id = p_entity_id
    and genealogy.parent_entity_id = (allocation->>'parent_entity_id')::uuid;
end;
$$;

revoke all on function public.save_rope_composition_metadata(uuid, numeric, numeric, timestamptz, jsonb)
  from public, anon;
grant execute on function public.save_rope_composition_metadata(uuid, numeric, numeric, timestamptz, jsonb)
  to authenticated;

drop trigger if exists guard_flat_yarn_batch_id_rename on public.entities;
drop function if exists public.guard_flat_yarn_batch_id_rename();

create or replace function public.guard_entity_batch_id_rename()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.batch_id is distinct from old.batch_id then
    if auth.uid() is not null and not public.current_user_is_admin() then
      raise exception 'Only an Admin may rename a batch identifier.';
    end if;
    if new.type = 'flat_yarn' and upper(btrim(new.batch_id)) like 'INTAKE-%' then
      raise exception 'Batch IDs beginning with INTAKE- are reserved for unnamed intake records.';
    end if;
    if nullif(btrim(new.batch_id), '') is null then
      raise exception 'A batch identifier is required.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_entity_batch_id_rename()
  from public, anon, authenticated;

drop trigger if exists guard_entity_batch_id_rename on public.entities;
create trigger guard_entity_batch_id_rename
  before update of batch_id on public.entities
  for each row execute function public.guard_entity_batch_id_rename();

commit;
