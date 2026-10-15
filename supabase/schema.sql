-- ==============================================================================
-- NAMAH TRACE V1 — Production Database Schema
-- Flexible Manufacturing Traceability for Flat Yarn -> Yarn -> Rope
-- ==============================================================================

create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES & ROLES
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'operator' check (role in ('admin', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    'operator'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. CORE ENTITIES (Flat Yarn, Yarn Batch, Rope Batch)
-- ------------------------------------------------------------------------------
create table if not exists public.entities (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('flat_yarn', 'yarn', 'rope')),
  batch_id text not null unique,
  supplier text,             -- Especially for Flat Yarn (e.g. 'ABC')
  treatment text,            -- Especially for Yarn (e.g. 'Twisting @ 1600 TPM')
  quantity numeric,          -- Optional portion/quantity
  estimated_output_quantity numeric check (
    estimated_output_quantity is null
    or (
      estimated_output_quantity >= 0
      and estimated_output_quantity::text not in ('NaN', 'Infinity', '-Infinity')
    )
  ),
  wastage_percentage numeric check (
    wastage_percentage is null
    or (
      wastage_percentage between 0 and 100
      and wastage_percentage::text not in ('NaN', 'Infinity', '-Infinity')
    )
  ),
  unit text,                 -- e.g. 'kg', 'm', 'coils'
  critical_quantity_threshold numeric,
  critical_quantity_threshold_unit text,
  status text check (status in ('In Progress', 'Completed')),
  notes text,                -- Remarks / initial observations
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entities_batch_id on public.entities(batch_id);
create index if not exists idx_entities_type on public.entities(type);
create index if not exists idx_entities_status on public.entities(status);
create index if not exists idx_entities_created_at on public.entities(created_at desc);

create table if not exists public.yarn_configurations (
  id uuid primary key default uuid_generate_v4(),
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

-- ------------------------------------------------------------------------------
-- 3. ENTITY GENEALOGY (Parent-Child Directed Graph)
-- ------------------------------------------------------------------------------
-- Flat Yarn -> Yarn Batch (1 parent Flat Yarn per Yarn Batch)
-- Yarn Batch -> Rope Batch (1 or more Yarn Batches per Rope Batch)
create table if not exists public.entity_genealogy (
  id uuid primary key default uuid_generate_v4(),
  parent_entity_id uuid not null references public.entities(id) on delete cascade,
  child_entity_id uuid not null references public.entities(id) on delete cascade,
  quantity_used numeric,
  unit text,
  remarks text,
  created_at timestamptz not null default now(),
  unique (parent_entity_id, child_entity_id)
);

create index if not exists idx_genealogy_parent on public.entity_genealogy(parent_entity_id);
create index if not exists idx_genealogy_child on public.entity_genealogy(child_entity_id);

-- ------------------------------------------------------------------------------
-- 4. FLEXIBLE PARAMETERS & SPECIFICATIONS
-- ------------------------------------------------------------------------------
-- Dynamic recording: BS, Elongation, Denier, TPM, S, BWS, etc.
create table if not exists public.entity_parameters (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null,
  value text not null,
  unit text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists idx_params_entity on public.entity_parameters(entity_id);

-- ------------------------------------------------------------------------------
-- 5. PROCESS & LIFECYCLE RECORDS
-- ------------------------------------------------------------------------------
-- Chronological processes: Heat Setting, Knitting, Twisting, Braiding, Dyeing, etc.
create table if not exists public.entity_processes (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  process_name text not null,
  specification text,
  remarks text,
  performed_by uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_processes_entity on public.entity_processes(entity_id);

-- ------------------------------------------------------------------------------
-- 6. TESTS & QC OBSERVATIONS
-- ------------------------------------------------------------------------------
create table if not exists public.entity_tests (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  process_id uuid references public.entity_processes(id) on delete set null,
  test_name text not null,
  value text not null,
  unit text,
  product_category text,
  applicable_standard text,
  remarks text,
  result text default 'Pass',
  performed_by uuid references public.profiles(id) on delete set null,
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_tests_entity on public.entity_tests(entity_id);
create index if not exists idx_tests_process on public.entity_tests(process_id);

create or replace function public.validate_test_process_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.process_id is not null and not exists (
    select 1 from public.entity_processes p
    where p.id = new.process_id and p.entity_id = new.entity_id
  ) then
    raise exception 'Test process must belong to the same batch.';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_test_process_link()
  from public, anon, authenticated;

drop trigger if exists validate_test_process_link on public.entity_tests;
create trigger validate_test_process_link
before insert or update of entity_id, process_id
on public.entity_tests
for each row execute function public.validate_test_process_link();

-- ------------------------------------------------------------------------------
-- 7. EVIDENCE & ATTACHMENTS
-- ------------------------------------------------------------------------------
create table if not exists public.entity_evidence (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  process_id uuid references public.entity_processes(id) on delete set null,
  parameter_id uuid references public.entity_parameters(id) on delete set null,
  test_id uuid references public.entity_tests(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(process_id, parameter_id, test_id) <= 1)
);

create index if not exists idx_evidence_entity on public.entity_evidence(entity_id);
create index if not exists idx_evidence_parameter on public.entity_evidence(parameter_id);
create index if not exists idx_evidence_test on public.entity_evidence(test_id);

create or replace function public.validate_evidence_record_links()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.process_id is not null and not exists (
    select 1 from public.entity_processes p
    where p.id = new.process_id and p.entity_id = new.entity_id
  ) then
    raise exception 'Evidence process must belong to the same batch.';
  end if;

  if new.parameter_id is not null and not exists (
    select 1 from public.entity_parameters p
    where p.id = new.parameter_id and p.entity_id = new.entity_id
  ) then
    raise exception 'Evidence parameter must belong to the same batch.';
  end if;

  if new.test_id is not null and not exists (
    select 1 from public.entity_tests t
    where t.id = new.test_id and t.entity_id = new.entity_id
  ) then
    raise exception 'Evidence test must belong to the same batch.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_evidence_record_links() from public, anon, authenticated;

drop trigger if exists validate_evidence_record_links on public.entity_evidence;
create trigger validate_evidence_record_links
before insert or update of entity_id, process_id, parameter_id, test_id
on public.entity_evidence
for each row execute function public.validate_evidence_record_links();

-- ------------------------------------------------------------------------------
-- 8. AUDIT HISTORY
-- ------------------------------------------------------------------------------
create table if not exists public.entity_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  details jsonb,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_entity on public.entity_audit_logs(entity_id);
create index if not exists idx_audit_created_at on public.entity_audit_logs(created_at desc);

-- ------------------------------------------------------------------------------
-- 9. TRUSTED ROLE AND ACTOR HELPERS
-- ------------------------------------------------------------------------------
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;

create or replace function public.current_user_has_operational_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'operator')
  );
$$;

revoke all on function public.current_user_has_operational_access() from public, anon;
grant execute on function public.current_user_has_operational_access() to authenticated;

create or replace function public.guard_critical_stock_threshold()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is not null
     and not public.current_user_is_admin()
     and (
       new.critical_quantity_threshold is distinct from old.critical_quantity_threshold
       or new.critical_quantity_threshold_unit is distinct from old.critical_quantity_threshold_unit
     ) then
    raise exception 'Only an Admin may change a critical stock threshold.';
  end if;

  if new.critical_quantity_threshold is not null and (
    new.critical_quantity_threshold < 0
    or new.critical_quantity_threshold::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Critical stock threshold must be finite and non-negative.';
  end if;

  if new.critical_quantity_threshold is not null
     and (
       nullif(btrim(new.unit), '') is null
       or nullif(btrim(new.critical_quantity_threshold_unit), '') is null
       or new.unit is distinct from new.critical_quantity_threshold_unit
     ) then
    raise exception 'Critical stock threshold unit must match the batch stock unit.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_critical_stock_threshold()
  from public, anon, authenticated;

drop trigger if exists guard_critical_stock_threshold on public.entities;
create trigger guard_critical_stock_threshold
before insert or update of unit, critical_quantity_threshold, critical_quantity_threshold_unit
on public.entities
for each row execute function public.guard_critical_stock_threshold();

create or replace function public.enforce_authenticated_actor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_actor_value jsonb;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_actor_value := to_jsonb(auth.uid());
  else
    v_actor_value := to_jsonb(old) -> tg_argv[0];
  end if;

  new := jsonb_populate_record(
    new,
    jsonb_build_object(tg_argv[0], v_actor_value)
  );
  return new;
end;
$$;

drop trigger if exists entities_authenticated_actor on public.entities;
create trigger entities_authenticated_actor
before insert or update on public.entities
for each row execute function public.enforce_authenticated_actor('created_by');

drop trigger if exists processes_authenticated_actor on public.entity_processes;
create trigger processes_authenticated_actor
before insert or update on public.entity_processes
for each row execute function public.enforce_authenticated_actor('performed_by');

drop trigger if exists tests_authenticated_actor on public.entity_tests;
create trigger tests_authenticated_actor
before insert or update on public.entity_tests
for each row execute function public.enforce_authenticated_actor('performed_by');

drop trigger if exists evidence_authenticated_actor on public.entity_evidence;
create trigger evidence_authenticated_actor
before insert or update on public.entity_evidence
for each row execute function public.enforce_authenticated_actor('uploaded_by');

drop trigger if exists audit_authenticated_actor on public.entity_audit_logs;
create trigger audit_authenticated_actor
before insert or update on public.entity_audit_logs
for each row execute function public.enforce_authenticated_actor('performed_by');

drop trigger if exists yarn_configurations_authenticated_actor on public.yarn_configurations;
create trigger yarn_configurations_authenticated_actor
before insert or update on public.yarn_configurations
for each row execute function public.enforce_authenticated_actor('created_by');

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.entities enable row level security;
alter table public.entity_genealogy enable row level security;
alter table public.entity_parameters enable row level security;
alter table public.entity_tests enable row level security;
alter table public.entity_processes enable row level security;
alter table public.entity_evidence enable row level security;
alter table public.entity_audit_logs enable row level security;
alter table public.yarn_configurations enable row level security;

-- Replace the earlier broad authenticated-user policies safely.
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Authenticated users can manage profiles" on public.profiles;
drop policy if exists "Authenticated users can read entities" on public.entities;
drop policy if exists "Authenticated users can manage entities" on public.entities;
drop policy if exists "Authenticated users can read genealogy" on public.entity_genealogy;
drop policy if exists "Authenticated users can manage genealogy" on public.entity_genealogy;
drop policy if exists "Authenticated users can read parameters" on public.entity_parameters;
drop policy if exists "Authenticated users can manage parameters" on public.entity_parameters;
drop policy if exists "Authenticated users can read tests" on public.entity_tests;
drop policy if exists "Authenticated users can manage tests" on public.entity_tests;
drop policy if exists "Authenticated users can read processes" on public.entity_processes;
drop policy if exists "Authenticated users can manage processes" on public.entity_processes;
drop policy if exists "Authenticated users can read evidence" on public.entity_evidence;
drop policy if exists "Authenticated users can manage evidence" on public.entity_evidence;
drop policy if exists "Authenticated users can read audit logs" on public.entity_audit_logs;
drop policy if exists "Authenticated users can insert audit logs" on public.entity_audit_logs;

-- Keep this role-policy section safe to reapply after schema updates.
drop policy if exists "Admins can create profiles" on public.profiles;
drop policy if exists "Admins can update other profiles" on public.profiles;
drop policy if exists "Admins can delete other profiles" on public.profiles;
drop policy if exists "Authenticated users can create entities" on public.entities;
drop policy if exists "Authenticated users can update entities" on public.entities;
drop policy if exists "Admins can delete entities" on public.entities;
drop policy if exists "Admins can manage entities" on public.entities;
drop policy if exists "Admins can manage genealogy" on public.entity_genealogy;
drop policy if exists "Authenticated users can create parameters" on public.entity_parameters;
drop policy if exists "Authenticated users can update parameters" on public.entity_parameters;
drop policy if exists "Admins can delete parameters" on public.entity_parameters;
drop policy if exists "Admins can manage parameters" on public.entity_parameters;
drop policy if exists "Authenticated users can create tests" on public.entity_tests;
drop policy if exists "Authenticated users can update tests" on public.entity_tests;
drop policy if exists "Admins can delete tests" on public.entity_tests;
drop policy if exists "Admins can manage tests" on public.entity_tests;
drop policy if exists "Authenticated users can create processes" on public.entity_processes;
drop policy if exists "Authenticated users can update processes" on public.entity_processes;
drop policy if exists "Admins can delete processes" on public.entity_processes;
drop policy if exists "Admins can manage processes" on public.entity_processes;
drop policy if exists "Admins can manage audit logs" on public.entity_audit_logs;
drop policy if exists "Operational users can read Yarn configurations" on public.yarn_configurations;
drop policy if exists "Operational users can create Yarn configurations" on public.yarn_configurations;
drop policy if exists "Operational users can update Yarn configurations" on public.yarn_configurations;
drop policy if exists "Admins can delete Yarn configurations" on public.yarn_configurations;
drop policy if exists "Admins can manage Yarn configurations" on public.yarn_configurations;
drop policy if exists "Authenticated users can read evidence metadata" on public.entity_evidence;
drop policy if exists "Authenticated users can create evidence metadata" on public.entity_evidence;
drop policy if exists "Authenticated users can update evidence metadata" on public.entity_evidence;
drop policy if exists "Admins can delete evidence metadata" on public.entity_evidence;
drop policy if exists "Admins can manage evidence metadata" on public.entity_evidence;
drop policy if exists "Authenticated users can read evidence files" on storage.objects;
drop policy if exists "Authenticated users can upload evidence files" on storage.objects;
drop policy if exists "Authenticated users can update evidence files" on storage.objects;
drop policy if exists "Admins can delete evidence files" on storage.objects;

-- Profiles: all authenticated users may read display names; only an Admin can
-- manage another user's profile. The Admin policy intentionally excludes self.
create policy "Authenticated users can read profiles"
  on public.profiles for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Admins can create profiles"
  on public.profiles for insert to authenticated
  with check (public.current_user_is_admin() and id <> auth.uid());
create policy "Admins can update other profiles"
  on public.profiles for update to authenticated
  using (public.current_user_is_admin() and id <> auth.uid())
  with check (public.current_user_is_admin() and id <> auth.uid());
create policy "Admins can delete other profiles"
  on public.profiles for delete to authenticated
  using (public.current_user_is_admin() and id <> auth.uid());

-- Entities: Operators may read/create/update; only Admins may delete.
create policy "Authenticated users can read entities"
  on public.entities for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Authenticated users can create entities"
  on public.entities for insert to authenticated
  with check (public.current_user_has_operational_access());
create policy "Authenticated users can update entities"
  on public.entities for update to authenticated
  using (public.current_user_has_operational_access())
  with check (public.current_user_has_operational_access());
create policy "Admins can delete entities"
  on public.entities for delete to authenticated
  using (public.current_user_is_admin());
create policy "Admins can manage entities"
  on public.entities for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Genealogy: direct Operator writes are denied. Quantity allocation is expected
-- to use the existing protected database mechanism. Admins retain full access.
create policy "Authenticated users can read genealogy"
  on public.entity_genealogy for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Admins can manage genealogy"
  on public.entity_genealogy for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Operational child records: Operators may read/create/update; Admins may delete.
create policy "Authenticated users can read parameters"
  on public.entity_parameters for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Authenticated users can create parameters"
  on public.entity_parameters for insert to authenticated
  with check (public.current_user_has_operational_access());
create policy "Authenticated users can update parameters"
  on public.entity_parameters for update to authenticated
  using (public.current_user_has_operational_access())
  with check (public.current_user_has_operational_access());
create policy "Admins can delete parameters"
  on public.entity_parameters for delete to authenticated using (public.current_user_is_admin());
create policy "Admins can manage parameters"
  on public.entity_parameters for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "Authenticated users can read tests"
  on public.entity_tests for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Authenticated users can create tests"
  on public.entity_tests for insert to authenticated
  with check (public.current_user_has_operational_access());
create policy "Authenticated users can update tests"
  on public.entity_tests for update to authenticated
  using (public.current_user_has_operational_access())
  with check (public.current_user_has_operational_access());
create policy "Admins can delete tests"
  on public.entity_tests for delete to authenticated using (public.current_user_is_admin());
create policy "Admins can manage tests"
  on public.entity_tests for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "Authenticated users can read processes"
  on public.entity_processes for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Authenticated users can create processes"
  on public.entity_processes for insert to authenticated
  with check (public.current_user_has_operational_access());
create policy "Authenticated users can update processes"
  on public.entity_processes for update to authenticated
  using (public.current_user_has_operational_access())
  with check (public.current_user_has_operational_access());
create policy "Admins can delete processes"
  on public.entity_processes for delete to authenticated using (public.current_user_is_admin());
create policy "Admins can manage processes"
  on public.entity_processes for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "Authenticated users can read evidence metadata"
  on public.entity_evidence for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Authenticated users can create evidence metadata"
  on public.entity_evidence for insert to authenticated
  with check (public.current_user_has_operational_access());
create policy "Authenticated users can update evidence metadata"
  on public.entity_evidence for update to authenticated
  using (public.current_user_has_operational_access())
  with check (public.current_user_has_operational_access());
create policy "Admins can delete evidence metadata"
  on public.entity_evidence for delete to authenticated using (public.current_user_is_admin());
create policy "Admins can manage evidence metadata"
  on public.entity_evidence for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- Audit history: append-only for Operators; Admins have full table access.
create policy "Authenticated users can read audit logs"
  on public.entity_audit_logs for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Authenticated users can insert audit logs"
  on public.entity_audit_logs for insert to authenticated
  with check (public.current_user_has_operational_access());
create policy "Admins can manage audit logs"
  on public.entity_audit_logs for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

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

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Authenticated users can access evidence" on storage.objects;
create policy "Authenticated users can read evidence files"
  on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.current_user_has_operational_access());
create policy "Authenticated users can upload evidence files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.current_user_has_operational_access());
create policy "Authenticated users can update evidence files"
  on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and public.current_user_has_operational_access())
  with check (bucket_id = 'evidence' and public.current_user_has_operational_access());
create policy "Admins can delete evidence files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and public.current_user_is_admin());
