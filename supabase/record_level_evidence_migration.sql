-- Add direct evidence links for process, parameter, or test records.
-- Existing batch-level and process-linked evidence remains valid.
begin;

alter table public.entity_evidence
  add column if not exists parameter_id uuid,
  add column if not exists test_id uuid;

do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entity_evidence'::regclass
      and conname = 'entity_evidence_parameter_id_fkey'
  ) then
    alter table public.entity_evidence
      add constraint entity_evidence_parameter_id_fkey
      foreign key (parameter_id)
      references public.entity_parameters(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entity_evidence'::regclass
      and conname = 'entity_evidence_test_id_fkey'
  ) then
    alter table public.entity_evidence
      add constraint entity_evidence_test_id_fkey
      foreign key (test_id)
      references public.entity_tests(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.entity_evidence'::regclass
      and conname = 'entity_evidence_one_record_link'
  ) then
    alter table public.entity_evidence
      add constraint entity_evidence_one_record_link
      check (num_nonnulls(process_id, parameter_id, test_id) <= 1)
      not valid;
  end if;
end;
$migration$;

create index if not exists idx_evidence_parameter
  on public.entity_evidence(parameter_id);
create index if not exists idx_evidence_test
  on public.entity_evidence(test_id);

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
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
