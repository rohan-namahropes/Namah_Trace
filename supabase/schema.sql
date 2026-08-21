-- Namah Trace MVP schema
-- Run this in Supabase SQL Editor, then create a public Storage bucket named `evidence`.

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_stages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  position integer not null,
  is_active boolean not null default true,
  field_config jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.batches (
  id text primary key,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  status text not null default 'In Progress' check (status in ('In Progress', 'Completed', 'On Hold')),
  attachment_path text
);

create table if not exists public.batch_stages (
  id uuid primary key default uuid_generate_v4(),
  batch_id text not null references public.batches(id) on delete cascade,
  stage_id uuid not null references public.workflow_stages(id),
  status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Completed', 'On Hold')),
  performed_by uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  unique(batch_id, stage_id)
);

create table if not exists public.stage_measurements (
  id uuid primary key default uuid_generate_v4(),
  batch_stage_id uuid not null references public.batch_stages(id) on delete cascade,
  field_name text not null,
  field_value text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default uuid_generate_v4(),
  batch_id text not null references public.batches(id) on delete cascade,
  batch_stage_id uuid references public.batch_stages(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.batch_history (
  id uuid primary key default uuid_generate_v4(),
  batch_id text not null references public.batches(id) on delete cascade,
  batch_stage_id uuid references public.batch_stages(id) on delete set null,
  action text not null,
  status text,
  notes text,
  performed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

insert into public.workflow_stages (name, position, field_config)
select * from (values
  ('Initial Yarn Testing', 1, '[{"key":"BS","label":"Breaking strength"},{"key":"Elongation","label":"Elongation"}]'::jsonb),
  ('Twisting', 2, '[{"key":"TPM","label":"Twists per metre"}]'::jsonb),
  ('Dyeing', 3, '[]'::jsonb),
  ('Braiding', 4, '[]'::jsonb),
  ('Rope Testing', 5, '[]'::jsonb),
  ('Packaging', 6, '[]'::jsonb)
) as defaults(name, position, field_config)
where not exists (select 1 from public.workflow_stages);

alter table public.profiles enable row level security;
alter table public.workflow_stages enable row level security;
alter table public.batches enable row level security;
alter table public.batch_stages enable row level security;
alter table public.stage_measurements enable row level security;
alter table public.evidence enable row level security;
alter table public.batch_history enable row level security;

create policy "Authenticated users can view profiles" on public.profiles for select to authenticated using (true);
create policy "Authenticated users can manage workflow stages" on public.workflow_stages for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage batches" on public.batches for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage batch stages" on public.batch_stages for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage measurements" on public.stage_measurements for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage evidence" on public.evidence for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage history" on public.batch_history for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false) on conflict (id) do nothing;
create policy "Authenticated users can access evidence" on storage.objects for all to authenticated using (bucket_id = 'evidence') with check (bucket_id = 'evidence');
