sql
-- Namah Trace V1 entity schema provisioning.
-- Adds only the entity-based Trace tables; legacy batch tables and data are untouched.
-- Requires public.profiles to exist with its current id, display_name, role,
-- created_at, and updated_at columns.

begin;

-- Core batches: Flat Yarn, Yarn, and Rope.
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('flat_yarn', 'yarn', 'rope')),
  batch_id text not null unique,
  supplier text,
  treatment text,
  quantity numeric,
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
  unit text,
  critical_quantity_threshold numeric,
  critical_quantity_threshold_unit text,
  status text check (status in ('In Progress', 'Completed')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entities_batch_id on public.entities(batch_id);
create index if not exists idx_entities_type on public.entities(type);
create index if not exists idx_entities_status on public.entities(status);
create index if not exists idx_entities_created_at on public.entities(created_at desc);

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

create index if not exists idx_yarn_configurations_name
  on public.yarn_configurations(name);

grant select, insert, update, delete
  on public.yarn_configurations to authenticated;

-- Parent-child material genealogy; allocation enforcement is provisioned separately.
create table if not exists public.entity_genealogy (
  id uuid primary key default gen_random_uuid(),
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

-- Flexible process parameters and specifications.
create table if not exists public.entity_parameters (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null,
  value text not null,
  unit text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists idx_params_entity on public.entity_parameters(entity_id);

-- Manufacturing process and lifecycle records.
create table if not exists public.entity_processes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  process_name text not null,
  specification text,
  remarks text,
  performed_by uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_processes_entity on public.entity_processes(entity_id);

-- Quality-control tests and observations; process linkage is optional.
create table if not exists public.entity_tests (
  id uuid primary key default gen_random_uuid(),
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

-- Evidence metadata only; this migration does not create or configure Storage.
create table if not exists public.entity_evidence (
  id uuid primary key default gen_random_uuid(),
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

revoke all on function public.validate_evidence_record_links()
  from public, anon, authenticated;

drop trigger if exists validate_evidence_record_links
  on public.entity_evidence;
create trigger validate_evidence_record_links
before insert or update of entity_id, process_id, parameter_id, test_id
on public.entity_evidence
for each row execute function public.validate_evidence_record_links();

-- Audit history, including the field-level columns used by the current API.
create table if not exists public.entity_audit_logs (
  id uuid primary key default gen_random_uuid(),
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

commit;
