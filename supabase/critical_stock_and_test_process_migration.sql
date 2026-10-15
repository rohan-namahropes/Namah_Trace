-- Additive migration for Flat Yarn critical-stock thresholds and optional
-- test-to-process links. Existing batch records and tests remain unchanged.
begin;

alter table public.entities
  add column if not exists critical_quantity_threshold numeric,
  add column if not exists critical_quantity_threshold_unit text;

alter table public.entity_tests
  add column if not exists process_id uuid,
  add column if not exists product_category text,
  add column if not exists applicable_standard text;

alter table public.entity_tests
  alter column process_id drop not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.entity_tests'::regclass
      and conname = 'entity_tests_process_id_fkey'
  ) then
    alter table public.entity_tests
      add constraint entity_tests_process_id_fkey
      foreign key (process_id)
      references public.entity_processes(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.entities'::regclass
      and conname = 'entities_critical_threshold_valid'
  ) then
    alter table public.entities
      add constraint entities_critical_threshold_valid
      check (
        critical_quantity_threshold is null
        or (
          critical_quantity_threshold >= 0
          and critical_quantity_threshold::text not in ('NaN', 'Infinity', '-Infinity')
          and nullif(btrim(critical_quantity_threshold_unit), '') is not null
        )
      )
      not valid;
  end if;
end;
$migration$;

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

commit;
