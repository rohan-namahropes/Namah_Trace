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
  unit text,
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

-- Quality-control tests and observations.
create table if not exists public.entity_tests (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  test_name text not null,
  value text not null,
  unit text,
  remarks text,
  result text default 'Pass',
  performed_by uuid references public.profiles(id) on delete set null,
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_tests_entity on public.entity_tests(entity_id);

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

-- Evidence metadata only; this migration does not create or configure Storage.
create table if not exists public.entity_evidence (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  process_id uuid references public.entity_processes(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_entity on public.entity_evidence(entity_id);

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
