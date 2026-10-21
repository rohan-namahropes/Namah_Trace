-- Run after schema.sql and authorization_v1.sql.

create table if not exists public.user_dismissed_stock_alerts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);

alter table public.user_dismissed_stock_alerts enable row level security;
grant select, insert on public.user_dismissed_stock_alerts to authenticated;

drop policy if exists "Users can read their dismissed stock alerts"
  on public.user_dismissed_stock_alerts;
drop policy if exists "Users can dismiss their own stock alerts"
  on public.user_dismissed_stock_alerts;

create policy "Users can read their dismissed stock alerts"
  on public.user_dismissed_stock_alerts for select to authenticated
  using (user_id = auth.uid() and public.current_user_has_operational_access());
create policy "Users can dismiss their own stock alerts"
  on public.user_dismissed_stock_alerts for insert to authenticated
  with check (user_id = auth.uid() and public.current_user_has_operational_access());

-- Remove the earlier intake-name guard, which incorrectly required Completed.
drop trigger if exists guard_flat_yarn_permanent_batch_id on public.entities;
drop function if exists public.guard_flat_yarn_permanent_batch_id();

create or replace function public.guard_flat_yarn_batch_id_rename()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.batch_id is distinct from old.batch_id then
    if old.type <> 'flat_yarn' then
      raise exception 'Only Flat Yarn batch identifiers can be renamed.';
    end if;
    if auth.uid() is not null and not public.current_user_is_admin() then
      raise exception 'Only an Admin may rename a Flat Yarn batch identifier.';
    end if;
    if upper(btrim(new.batch_id)) like 'INTAKE-%' then
      raise exception 'Batch IDs beginning with INTAKE- are reserved for unnamed intake records.';
    end if;
    if nullif(btrim(new.batch_id), '') is null then
      raise exception 'A permanent Flat Yarn batch identifier is required before saving.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_flat_yarn_batch_id_rename()
  from public, anon, authenticated;

drop trigger if exists guard_flat_yarn_batch_id_rename on public.entities;
create trigger guard_flat_yarn_batch_id_rename
  before update of batch_id on public.entities
  for each row execute function public.guard_flat_yarn_batch_id_rename();

create or replace function public.prevent_temporary_flat_yarn_allocation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_parent public.entities%rowtype;
begin
  if tg_op = 'UPDATE' and new.parent_entity_id = old.parent_entity_id then
    return new;
  end if;

  select * into v_parent
  from public.entities
  where id = new.parent_entity_id;

  if v_parent.type = 'flat_yarn' and upper(v_parent.batch_id) like 'INTAKE-%' then
    raise exception 'Assign a permanent Flat Yarn batch ID before using an intake in Yarn production.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_temporary_flat_yarn_allocation()
  from public, anon, authenticated;

drop trigger if exists prevent_temporary_flat_yarn_allocation on public.entity_genealogy;
create trigger prevent_temporary_flat_yarn_allocation
  before insert or update of parent_entity_id on public.entity_genealogy
  for each row execute function public.prevent_temporary_flat_yarn_allocation();
