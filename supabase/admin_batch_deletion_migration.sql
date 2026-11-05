-- Apply after production_identity_access_migration.sql.
-- Limit batch deletion to Admins and prevent orphaning downstream production lots.
begin;

create or replace function public.guard_admin_batch_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Only an Admin can delete a batch.';
  end if;

  if exists (
    select 1
    from public.entity_genealogy g
    where g.parent_entity_id = old.id
  ) then
    raise exception 'Batch % has downstream lots. Delete its child lots first.', old.batch_id;
  end if;

  return old;
end;
$$;

revoke all on function public.guard_admin_batch_delete()
  from public, anon, authenticated;

drop trigger if exists guard_admin_batch_delete on public.entities;
create trigger guard_admin_batch_delete
before delete on public.entities
for each row execute function public.guard_admin_batch_delete();

drop policy if exists "Admins can delete entities" on public.entities;
drop policy if exists "Admins can manage entities" on public.entities;
drop policy if exists "Authorized users can delete entities" on public.entities;
create policy "Admins can delete entities"
  on public.entities for delete to authenticated
  using (public.current_user_is_admin());

drop policy if exists "Authorized users can delete evidence files" on storage.objects;
drop policy if exists "Admins can delete evidence files" on storage.objects;
create policy "Admins can delete evidence files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and public.current_user_is_admin());

create or replace function public.admin_delete_entity_batch(p_entity_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_batch_id text;
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Only an Admin can delete a batch.';
  end if;

  select e.batch_id
  into v_batch_id
  from public.entities e
  where e.id = p_entity_id
  for update;

  if not found then
    raise exception 'Batch not found or it has already been deleted.';
  end if;

  if exists (
    select 1
    from public.entity_genealogy g
    where g.parent_entity_id = p_entity_id
  ) then
    raise exception 'Batch % has downstream lots. Delete its child lots first.', v_batch_id;
  end if;

  delete from public.entities where id = p_entity_id;
  return v_batch_id;
end;
$$;

revoke all on function public.admin_delete_entity_batch(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_entity_batch(uuid)
  to authenticated;

commit;
