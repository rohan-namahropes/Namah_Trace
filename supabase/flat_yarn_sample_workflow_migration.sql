-- Structured cone sampling for Flat Yarn tests and parameters.
-- Apply after schema.sql, authorization_v1.sql, and factorflow_development_migration.sql.

begin;

alter table public.entity_tests
  add column if not exists sample_id text;

alter table public.entity_parameters
  add column if not exists sample_id text;

create table if not exists public.entity_samples (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  sample_id text not null,
  created_at timestamptz not null default now(),
  check (nullif(btrim(sample_id), '') is not null)
);

create unique index if not exists idx_entity_samples_entity_sample_lower
  on public.entity_samples(entity_id, lower(sample_id));

insert into public.entity_samples (entity_id, sample_id)
select distinct on (entity_id, lower(btrim(sample_id)))
  entity_id, btrim(sample_id)
from (
  select tests.entity_id, tests.sample_id
  from public.entity_tests tests
  join public.entities entities on entities.id = tests.entity_id
  where entities.type = 'flat_yarn'
    and nullif(btrim(tests.sample_id), '') is not null
  union
  select parameters.entity_id, parameters.sample_id
  from public.entity_parameters parameters
  join public.entities entities on entities.id = parameters.entity_id
  where entities.type = 'flat_yarn'
    and nullif(btrim(parameters.sample_id), '') is not null
) existing_samples
order by entity_id, lower(btrim(sample_id)), btrim(sample_id)
on conflict do nothing;

alter table public.entity_samples enable row level security;
grant select, insert on public.entity_samples to authenticated;

drop policy if exists "Operational users can read entity samples"
  on public.entity_samples;
drop policy if exists "Operational users can create entity samples"
  on public.entity_samples;

create policy "Operational users can read entity samples"
  on public.entity_samples for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Operational users can create entity samples"
  on public.entity_samples for insert to authenticated
  with check (
    public.current_user_has_operational_access()
    and exists (
      select 1
      from public.entities
      where entities.id = entity_samples.entity_id
        and entities.type = 'flat_yarn'
    )
  );

commit;
