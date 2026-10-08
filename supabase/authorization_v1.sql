-- Namah Trace Admin/Operator authorization foundation.
-- Safe to re-run against an existing database using the current schema.
-- This migration does not create or recreate application tables.

begin;

-- New users are always provisioned as Operators, regardless of Auth metadata.
-- Existing profile roles are preserved when the auth.users row is reprocessed.
alter table public.profiles
  alter column role set default 'operator';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
  for each row execute function public.handle_new_user();

-- SECURITY DEFINER avoids recursive profile RLS checks inside policies.
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

-- Authenticated client writes cannot spoof or change actor identity.
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

revoke all on function public.enforce_authenticated_actor() from public, anon, authenticated;

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

-- RLS must be enabled for role policies to enforce these permissions.
alter table public.profiles enable row level security;
alter table public.entities enable row level security;
alter table public.entity_genealogy enable row level security;
alter table public.entity_parameters enable row level security;
alter table public.entity_tests enable row level security;
alter table public.entity_processes enable row level security;
alter table public.entity_evidence enable row level security;
alter table public.entity_audit_logs enable row level security;

-- Remove the former broad authenticated-user policies.
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

-- Make replacement policy creation idempotent.
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
drop policy if exists "Authenticated users can read evidence metadata" on public.entity_evidence;
drop policy if exists "Authenticated users can create evidence metadata" on public.entity_evidence;
drop policy if exists "Authenticated users can update evidence metadata" on public.entity_evidence;
drop policy if exists "Admins can delete evidence metadata" on public.entity_evidence;
drop policy if exists "Admins can manage evidence metadata" on public.entity_evidence;
drop policy if exists "Authenticated users can access evidence" on storage.objects;
drop policy if exists "Authenticated users can read evidence files" on storage.objects;
drop policy if exists "Authenticated users can upload evidence files" on storage.objects;
drop policy if exists "Authenticated users can update evidence files" on storage.objects;
drop policy if exists "Admins can delete evidence files" on storage.objects;

-- Profiles: authenticated operational users can read profiles; Admins can
-- manage other users, but cannot alter their own role through this policy.
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

-- Operators may read/create/update entities; deletion is Admin-only.
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

-- Operator genealogy writes must go through the protected database mechanism.
create policy "Authenticated users can read genealogy"
  on public.entity_genealogy for select to authenticated
  using (public.current_user_has_operational_access());
create policy "Admins can manage genealogy"
  on public.entity_genealogy for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Parameters, tests, and processes: Operator create/update; Admin full access.
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
  on public.entity_parameters for delete to authenticated
  using (public.current_user_is_admin());
create policy "Admins can manage parameters"
  on public.entity_parameters for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

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
  on public.entity_tests for delete to authenticated
  using (public.current_user_is_admin());
create policy "Admins can manage tests"
  on public.entity_tests for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

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
  on public.entity_processes for delete to authenticated
  using (public.current_user_is_admin());
create policy "Admins can manage processes"
  on public.entity_processes for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Evidence metadata follows the same Operator/Admin permissions.
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
  on public.entity_evidence for delete to authenticated
  using (public.current_user_is_admin());
create policy "Admins can manage evidence metadata"
  on public.entity_evidence for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Audit is append-only for Operators; Admins may manage audit rows.
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

-- Keep evidence private and permit operational users to read/upload/update;
-- only Admins may delete stored evidence objects.
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do update set public = false;

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

commit;
