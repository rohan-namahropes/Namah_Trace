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
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'operator')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    role = coalesce(excluded.role, public.profiles.role);
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
  unit text,                 -- e.g. 'kg', 'm', 'coils'
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
-- 5. TESTS & QC OBSERVATIONS
-- ------------------------------------------------------------------------------
create table if not exists public.entity_tests (
  id uuid primary key default uuid_generate_v4(),
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

-- ------------------------------------------------------------------------------
-- 6. PROCESS & LIFECYCLE RECORDS
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
-- 7. EVIDENCE & ATTACHMENTS
-- ------------------------------------------------------------------------------
create table if not exists public.entity_evidence (
  id uuid primary key default uuid_generate_v4(),
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
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.entities enable row level security;
alter table public.entity_genealogy enable row level security;
alter table public.entity_parameters enable row level security;
alter table public.entity_tests enable row level security;
alter table public.entity_processes enable row level security;
alter table public.entity_evidence enable row level security;
alter table public.entity_audit_logs enable row level security;

-- Read policies for authenticated users
create policy "Authenticated users can read profiles" on public.profiles for select to authenticated using (true);
create policy "Authenticated users can read entities" on public.entities for select to authenticated using (true);
create policy "Authenticated users can read genealogy" on public.entity_genealogy for select to authenticated using (true);
create policy "Authenticated users can read parameters" on public.entity_parameters for select to authenticated using (true);
create policy "Authenticated users can read tests" on public.entity_tests for select to authenticated using (true);
create policy "Authenticated users can read processes" on public.entity_processes for select to authenticated using (true);
create policy "Authenticated users can read evidence" on public.entity_evidence for select to authenticated using (true);
create policy "Authenticated users can read audit logs" on public.entity_audit_logs for select to authenticated using (true);

-- Manage policies for authenticated users
create policy "Authenticated users can manage profiles" on public.profiles for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage entities" on public.entities for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage genealogy" on public.entity_genealogy for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage parameters" on public.entity_parameters for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage tests" on public.entity_tests for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage processes" on public.entity_processes for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage evidence" on public.entity_evidence for all to authenticated using (true) with check (true);
create policy "Authenticated users can insert audit logs" on public.entity_audit_logs for insert to authenticated with check (true);

-- Storage bucket
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', true) on conflict (id) do nothing;
drop policy if exists "Authenticated users can access evidence" on storage.objects;
create policy "Authenticated users can access evidence" on storage.objects for all to authenticated using (bucket_id = 'evidence') with check (bucket_id = 'evidence');
