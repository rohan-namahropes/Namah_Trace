-- Rope lot metadata, same-type colored output lots, and editable role permissions.
begin;

alter table public.entities
  add column if not exists rope_family text,
  add column if not exists rope_diameter text,
  add column if not exists color text;

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

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'operator', 'qc', 'viewer'));

create table if not exists public.role_permissions (
  role text primary key,
  display_name text not null,
  can_view boolean not null default false,
  can_produce boolean not null default false,
  can_edit boolean not null default false,
  can_process boolean not null default false,
  can_qc boolean not null default false,
  can_delete boolean not null default false,
  can_manage_users boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint role_permissions_role_valid
    check (role in ('admin', 'operator', 'qc', 'viewer')),
  constraint role_permissions_admin_access_required
    check (
      role <> 'admin'
      or (
        can_view and can_produce and can_edit and can_process
        and can_qc and can_delete and can_manage_users
      )
    )
);

insert into public.role_permissions (
  role, display_name, can_view, can_produce, can_edit,
  can_process, can_qc, can_delete, can_manage_users
)
values
  ('admin', 'Admin', true, true, true, true, true, true, true),
  ('operator', 'Production', true, true, false, true, false, false, false),
  ('qc', 'Quality Control', true, false, false, false, true, false, false),
  ('viewer', 'Read-only', true, false, false, false, false, false, false)
on conflict (role) do update set
  display_name = excluded.display_name;

alter table public.role_permissions enable row level security;
grant select, insert, update, delete on public.role_permissions to authenticated;

create or replace function public.current_user_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce((
    select case p_permission
      when 'view' then rp.can_view
      when 'produce' then rp.can_produce
      when 'edit' then rp.can_edit
      when 'process' then rp.can_process
      when 'qc' then rp.can_qc
      when 'delete' then rp.can_delete
      when 'manage_users' then rp.can_manage_users
      else false
    end
    from public.profiles p
    join public.role_permissions rp on rp.role = p.role
    where p.id = auth.uid()
  ), false);
$$;

revoke all on function public.current_user_has_permission(text) from public, anon;
grant execute on function public.current_user_has_permission(text) to authenticated;

create or replace function public.list_user_profiles_for_access()
returns table (id uuid, display_name text, email text, role text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.current_user_has_permission('manage_users') then
    raise exception 'User management access is required to list user accounts.';
  end if;

  return query
  select p.id, p.display_name, u.email::text, p.role
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.display_name, p.id;
end;
$$;

revoke all on function public.list_user_profiles_for_access() from public, anon, authenticated;
grant execute on function public.list_user_profiles_for_access() to authenticated;

create or replace function public.current_user_has_operational_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select (
    public.current_user_has_permission('produce')
    or public.current_user_has_permission('edit')
    or public.current_user_has_permission('process')
    or public.current_user_has_permission('qc')
  );
$$;

revoke all on function public.current_user_has_operational_access() from public, anon;
grant execute on function public.current_user_has_operational_access() to authenticated;

create or replace function public.guard_entity_production_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is not null
     and tg_op = 'INSERT'
     and not public.current_user_has_permission('produce') then
    raise exception 'Production access is required to create material lots.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_entity_production_write() from public, anon, authenticated;
drop trigger if exists guard_entity_production_write on public.entities;
create trigger guard_entity_production_write
before insert on public.entities
for each row execute function public.guard_entity_production_write();

create or replace function public.guard_production_metadata_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is not null
     and old.type = 'rope'
     and (
       new.rope_target_length is distinct from old.rope_target_length
       or new.rope_grams_per_meter is distinct from old.rope_grams_per_meter
       or new.rope_family is distinct from old.rope_family
       or new.rope_diameter is distinct from old.rope_diameter
     )
     and not public.current_user_has_permission('edit') then
    raise exception 'Edit access is required to change Rope production metadata.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_production_metadata_write() from public, anon, authenticated;
drop trigger if exists guard_production_metadata_write on public.entities;
create trigger guard_production_metadata_write
before update on public.entities
for each row execute function public.guard_production_metadata_write();

create or replace function public.guard_production_composition_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is not null
     and (
       new.component_role is distinct from old.component_role
       or new.composition_percentage is distinct from old.composition_percentage
     )
     and not public.current_user_has_permission('produce') then
    raise exception 'Production access is required to change Rope composition.';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_production_composition_write() from public, anon, authenticated;
drop trigger if exists guard_production_composition_write on public.entity_genealogy;
create trigger guard_production_composition_write
before update on public.entity_genealogy
for each row execute function public.guard_production_composition_write();

drop policy if exists "Role permissions are readable by authenticated users" on public.role_permissions;
drop policy if exists "Admins manage role permissions" on public.role_permissions;
drop policy if exists "Users with user-management access manage role permissions"
  on public.role_permissions;
create policy "Role permissions are readable by authenticated users"
  on public.role_permissions for select to authenticated
  using (public.current_user_has_permission('view'));
create policy "Users with user-management access manage role permissions"
  on public.role_permissions for all to authenticated
  using (public.current_user_has_permission('manage_users'))
  with check (public.current_user_has_permission('manage_users'));

drop policy if exists "Admins can create profiles" on public.profiles;
drop policy if exists "Admins can update other profiles" on public.profiles;
drop policy if exists "Admins can delete other profiles" on public.profiles;
create policy "Admins can create profiles"
  on public.profiles for insert to authenticated
  with check (public.current_user_has_permission('manage_users') and id <> auth.uid());
create policy "Admins can update other profiles"
  on public.profiles for update to authenticated
  using (public.current_user_has_permission('manage_users') and id <> auth.uid())
  with check (public.current_user_has_permission('manage_users') and id <> auth.uid());
create policy "Admins can delete other profiles"
  on public.profiles for delete to authenticated
  using (public.current_user_has_permission('manage_users') and id <> auth.uid());
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Users with view access can read profiles"
  on public.profiles for select to authenticated
  using (public.current_user_has_permission('view'));

do $migration$
begin
  if to_regclass('public.user_dismissed_stock_alerts') is not null then
    drop policy if exists "Users can read their dismissed stock alerts"
      on public.user_dismissed_stock_alerts;
    drop policy if exists "Users can dismiss their own stock alerts"
      on public.user_dismissed_stock_alerts;
    drop policy if exists "Users with view access can read their dismissed stock alerts"
      on public.user_dismissed_stock_alerts;
    drop policy if exists "Users with view access can dismiss their own stock alerts"
      on public.user_dismissed_stock_alerts;
    create policy "Users with view access can read their dismissed stock alerts"
      on public.user_dismissed_stock_alerts for select to authenticated
      using (user_id = auth.uid() and public.current_user_has_permission('view'));
    create policy "Users with view access can dismiss their own stock alerts"
      on public.user_dismissed_stock_alerts for insert to authenticated
      with check (user_id = auth.uid() and public.current_user_has_permission('view'));
  end if;
end;
$migration$;

drop policy if exists "Operational users can read process type specifications"
  on public.process_type_specifications;
create policy "Users with view access can read process type specifications"
  on public.process_type_specifications for select to authenticated
  using (public.current_user_has_permission('view'));
drop policy if exists "Operational users can read process specifications"
  on storage.objects;
create policy "Users with view access can read process specifications"
  on storage.objects for select to authenticated
  using (bucket_id = 'process-specifications' and public.current_user_has_permission('view'));

drop policy if exists "Authenticated users can read entities" on public.entities;
create policy "Users with view access can read entities"
  on public.entities for select to authenticated
  using (public.current_user_has_permission('view'));
drop policy if exists "Authenticated users can create entities" on public.entities;
drop policy if exists "Authenticated users can update entities" on public.entities;
drop policy if exists "Admins can delete entities" on public.entities;
drop policy if exists "Admins can manage entities" on public.entities;
create policy "Production users can create entities"
  on public.entities for insert to authenticated
  with check (public.current_user_has_permission('produce'));
create policy "Authorized users can update entities"
  on public.entities for update to authenticated
  using (public.current_user_has_permission('edit'))
  with check (public.current_user_has_permission('edit'));
create policy "Authorized users can delete entities"
  on public.entities for delete to authenticated
  using (public.current_user_has_permission('delete'));

drop policy if exists "Admins can manage genealogy" on public.entity_genealogy;
drop policy if exists "Authenticated users can read genealogy" on public.entity_genealogy;
create policy "Users with view access can read genealogy"
  on public.entity_genealogy for select to authenticated
  using (public.current_user_has_permission('view'));
create policy "Admins can manage genealogy"
  on public.entity_genealogy for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Authenticated users can create parameters" on public.entity_parameters;
drop policy if exists "Authenticated users can read parameters" on public.entity_parameters;
create policy "Users with view access can read parameters"
  on public.entity_parameters for select to authenticated
  using (public.current_user_has_permission('view'));
drop policy if exists "Authenticated users can update parameters" on public.entity_parameters;
drop policy if exists "Admins can delete parameters" on public.entity_parameters;
drop policy if exists "Admins can manage parameters" on public.entity_parameters;
create policy "QC users can create parameters"
  on public.entity_parameters for insert to authenticated
  with check (public.current_user_has_permission('qc'));
create policy "QC users can update parameters"
  on public.entity_parameters for update to authenticated
  using (public.current_user_has_permission('qc'))
  with check (public.current_user_has_permission('qc'));
create policy "Authorized users can delete parameters"
  on public.entity_parameters for delete to authenticated
  using (public.current_user_has_permission('delete'));

drop policy if exists "Authenticated users can create tests" on public.entity_tests;
drop policy if exists "Authenticated users can read tests" on public.entity_tests;
create policy "Users with view access can read tests"
  on public.entity_tests for select to authenticated
  using (public.current_user_has_permission('view'));
drop policy if exists "Authenticated users can update tests" on public.entity_tests;
drop policy if exists "Admins can delete tests" on public.entity_tests;
drop policy if exists "Admins can manage tests" on public.entity_tests;
create policy "QC users can create tests"
  on public.entity_tests for insert to authenticated
  with check (public.current_user_has_permission('qc'));
create policy "QC users can update tests"
  on public.entity_tests for update to authenticated
  using (public.current_user_has_permission('qc'))
  with check (public.current_user_has_permission('qc'));
create policy "Authorized users can delete tests"
  on public.entity_tests for delete to authenticated
  using (public.current_user_has_permission('delete'));

drop policy if exists "Authenticated users can create processes" on public.entity_processes;
drop policy if exists "Authenticated users can read processes" on public.entity_processes;
create policy "Users with view access can read processes"
  on public.entity_processes for select to authenticated
  using (public.current_user_has_permission('view'));
drop policy if exists "Authenticated users can update processes" on public.entity_processes;
drop policy if exists "Admins can delete processes" on public.entity_processes;
drop policy if exists "Admins can manage processes" on public.entity_processes;
create policy "Production users can create processes"
  on public.entity_processes for insert to authenticated
  with check (public.current_user_has_permission('process'));
create policy "Production users can update processes"
  on public.entity_processes for update to authenticated
  using (public.current_user_has_permission('process'))
  with check (public.current_user_has_permission('process'));
create policy "Authorized users can delete processes"
  on public.entity_processes for delete to authenticated
  using (public.current_user_has_permission('delete'));

drop policy if exists "Authenticated users can create evidence metadata" on public.entity_evidence;
drop policy if exists "Authenticated users can read evidence metadata" on public.entity_evidence;
create policy "Users with view access can read evidence metadata"
  on public.entity_evidence for select to authenticated
  using (public.current_user_has_permission('view'));
drop policy if exists "Authenticated users can update evidence metadata" on public.entity_evidence;
drop policy if exists "Admins can delete evidence metadata" on public.entity_evidence;
drop policy if exists "Admins can manage evidence metadata" on public.entity_evidence;
create policy "QC users can create evidence metadata"
  on public.entity_evidence for insert to authenticated
  with check (public.current_user_has_permission('qc'));
create policy "QC users can update evidence metadata"
  on public.entity_evidence for update to authenticated
  using (public.current_user_has_permission('qc'))
  with check (public.current_user_has_permission('qc'));
create policy "Authorized users can delete evidence metadata"
  on public.entity_evidence for delete to authenticated
  using (public.current_user_has_permission('delete'));

drop policy if exists "Authenticated users can insert audit logs" on public.entity_audit_logs;
drop policy if exists "Authenticated users can read audit logs" on public.entity_audit_logs;
create policy "Users with view access can read audit logs"
  on public.entity_audit_logs for select to authenticated
  using (public.current_user_has_permission('view'));
drop policy if exists "Admins can manage audit logs" on public.entity_audit_logs;
create policy "Operational users can insert audit logs"
  on public.entity_audit_logs for insert to authenticated
  with check (
    public.current_user_has_permission('produce')
    or public.current_user_has_permission('process')
    or public.current_user_has_permission('qc')
    or public.current_user_has_permission('delete')
  );
create policy "Admins can manage audit logs"
  on public.entity_audit_logs for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "Operational users can read Yarn configurations" on public.yarn_configurations;
drop policy if exists "Operational users can create Yarn configurations" on public.yarn_configurations;
drop policy if exists "Operational users can update Yarn configurations" on public.yarn_configurations;
drop policy if exists "Admins can delete Yarn configurations" on public.yarn_configurations;
drop policy if exists "Admins can manage Yarn configurations" on public.yarn_configurations;
create policy "Users with view access can read Yarn configurations"
  on public.yarn_configurations for select to authenticated
  using (public.current_user_has_permission('view'));
create policy "Production users can create Yarn configurations"
  on public.yarn_configurations for insert to authenticated
  with check (public.current_user_has_permission('produce'));
create policy "Admins can update Yarn configurations"
  on public.yarn_configurations for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
create policy "Admins can delete Yarn configurations"
  on public.yarn_configurations for delete to authenticated
  using (public.current_user_is_admin());

drop policy if exists "Authenticated users can read evidence files" on storage.objects;
drop policy if exists "Authenticated users can upload evidence files" on storage.objects;
drop policy if exists "Authenticated users can update evidence files" on storage.objects;
drop policy if exists "Admins can delete evidence files" on storage.objects;
create policy "Users with view access can read evidence files"
  on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.current_user_has_permission('view'));
create policy "QC users can upload evidence files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.current_user_has_permission('qc'));
create policy "QC users can update evidence files"
  on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and public.current_user_has_permission('qc'))
  with check (bucket_id = 'evidence' and public.current_user_has_permission('qc'));
create policy "Authorized users can delete evidence files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and public.current_user_has_permission('delete'));

do $migration$
begin
  if to_regclass('public.entity_samples') is not null then
    drop policy if exists "Operational users can read entity samples"
      on public.entity_samples;
    drop policy if exists "Operational users can create entity samples"
      on public.entity_samples;
    create policy "Users with view access can read entity samples"
      on public.entity_samples for select to authenticated
      using (public.current_user_has_permission('view'));
    create policy "QC users can create entity samples"
      on public.entity_samples for insert to authenticated
      with check (public.current_user_has_permission('qc'));
  end if;
end;
$migration$;

create or replace function public.save_rope_identity_metadata(
  p_entity_id uuid,
  p_rope_family text,
  p_rope_diameter text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.current_user_has_permission('produce') then
    raise exception 'Production access is required to save Rope identity metadata.';
  end if;
  if p_rope_family not in ('NL', 'NI') then
    raise exception 'Rope family must be NL or NI.';
  end if;
  if nullif(btrim(p_rope_diameter), '') is null then
    raise exception 'Rope diameter is required.';
  end if;

  update public.entities
  set rope_family = p_rope_family,
      rope_diameter = btrim(p_rope_diameter)
  where id = p_entity_id and type = 'rope';
  if not found then
    raise exception 'Rope batch was not found.';
  end if;

  insert into public.entity_audit_logs (entity_id, action, details, performed_by)
  values (
    p_entity_id,
    'Recorded Rope lot identity details',
    jsonb_build_object(
      'field_name', 'rope_identity',
      'rope_family', p_rope_family,
      'rope_diameter', btrim(p_rope_diameter)
    ),
    auth.uid()
  );
end;
$$;

revoke all on function public.save_rope_identity_metadata(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.save_rope_identity_metadata(uuid, text, text)
  to authenticated;

create or replace function public.create_colored_material_lot(
  p_parent_entity_id uuid,
  p_color text,
  p_quantity_used numeric,
  p_output_quantity numeric,
  p_unit text,
  p_occurred_at timestamptz,
  p_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_parent public.entities%rowtype;
  v_child_id uuid;
  v_base_id text;
  v_color_slug text;
  v_child_batch_id text;
  v_sequence numeric;
  v_parent_available numeric;
  v_consumed numeric;
  v_unknown boolean;
  v_previous_rpc_marker text;
  v_color text := nullif(btrim(p_color), '');
  v_unit text := nullif(btrim(p_unit), '');
begin
  if not public.current_user_has_permission('produce') then
    raise exception 'Production access is required to create a colored material lot.';
  end if;
  if v_color is null then
    raise exception 'Color is required.';
  end if;
  if char_length(v_color) > 80 then
    raise exception 'Color must be 80 characters or fewer.';
  end if;
  if p_quantity_used is null or p_quantity_used <= 0
     or p_quantity_used::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Consumed quantity must be finite and positive.';
  end if;
  if p_output_quantity is null or p_output_quantity < 0
     or p_output_quantity::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Output quantity must be finite and non-negative.';
  end if;
  if v_unit is null then
    raise exception 'A quantity unit is required.';
  end if;

  select * into v_parent
  from public.entities
  where id = p_parent_entity_id
  for update;
  if not found or v_parent.type not in ('flat_yarn', 'yarn') then
    raise exception 'Select an existing Flat Yarn or Yarn lot.';
  end if;
  v_parent_available := v_parent.quantity;
  if v_parent_available is null and v_parent.type = 'yarn' then
    v_parent_available := v_parent.estimated_output_quantity;
  end if;
  if v_parent_available is null or v_parent.unit is null
     or v_parent_available < 0
     or v_parent_available::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'The source lot must have a known quantity and unit.';
  end if;
  if v_parent.color is not null and lower(v_parent.color) = lower(v_color) then
    raise exception 'This source lot is already recorded as color %.', v_color;
  end if;
  if v_parent.unit <> v_unit then
    raise exception 'Consumed quantity unit must match source lot unit (%).', v_parent.unit;
  end if;

  select
    coalesce(bool_or(
      g.quantity_used is null
      or g.quantity_used <= 0
      or g.quantity_used::text in ('NaN', 'Infinity', '-Infinity')
      or g.unit is distinct from v_parent.unit
    ), false),
    coalesce(sum(g.quantity_used), 0)
  into v_unknown, v_consumed
  from public.entity_genealogy g
  where g.parent_entity_id = v_parent.id;
  if v_unknown then
    raise exception 'Source lot availability is unknown because of historical allocations.';
  end if;
  if p_quantity_used + v_consumed > v_parent_available then
    raise exception 'Insufficient source material: available %, requested % %.',
      v_parent_available - v_consumed, p_quantity_used, v_unit;
  end if;

  v_color_slug := coalesce(
    nullif(trim(both '-' from upper(regexp_replace(v_color, '[^A-Za-z0-9]+', '-', 'g'))), ''),
    'COLOR'
  );
  v_base_id := v_parent.batch_id || '-C-' || v_color_slug;
  perform pg_advisory_xact_lock(42002, hashtext(v_base_id));
  select coalesce(max(
    case
      when substring(e.batch_id from char_length(v_base_id) + 2) ~ '^[0-9]+$'
        then substring(e.batch_id from char_length(v_base_id) + 2)::numeric
      else null
    end
  ), 0) + 1
  into v_sequence
  from public.entities e
  where e.type = v_parent.type
    and left(e.batch_id, char_length(v_base_id) + 1) = v_base_id || '-';
  if v_sequence > 2147483647 then
    raise exception 'Color lot sequence is exhausted for base ID %.', v_base_id;
  end if;
  v_child_batch_id := v_base_id || '-' || lpad(v_sequence::text, 2, '0');

  v_previous_rpc_marker := current_setting('namah_trace.allocation_rpc', true);
  perform set_config('namah_trace.allocation_rpc', 'on', true);

  insert into public.entities (
    type, batch_id, supplier, treatment, denier, twist_direction,
    twist_direction_other, yarn_category, quantity, unit, status, notes,
    color, created_by, occurred_at
  )
  values (
    v_parent.type,
    v_child_batch_id,
    v_parent.supplier,
    v_parent.treatment,
    v_parent.denier,
    v_parent.twist_direction,
    v_parent.twist_direction_other,
    v_parent.yarn_category,
    p_output_quantity,
    v_unit,
    'In Progress',
    nullif(btrim(p_remarks), ''),
    v_color,
    auth.uid(),
    coalesce(p_occurred_at, now())
  )
  returning id into v_child_id;

  insert into public.entity_genealogy (
    parent_entity_id, child_entity_id, quantity_used, unit, remarks
  )
  values (v_parent.id, v_child_id, p_quantity_used, v_unit, nullif(btrim(p_remarks), ''));

  insert into public.entity_processes (
    entity_id, process_name, specification, remarks, performed_by, performed_at
  )
  values (
    v_child_id, 'Coloring', v_color, nullif(btrim(p_remarks), ''),
    auth.uid(), coalesce(p_occurred_at, now())
  );

  insert into public.entity_audit_logs (entity_id, action, details, performed_by)
  values (
    v_child_id,
    format('Created colored %s lot %s', initcap(v_parent.type), v_child_batch_id),
    jsonb_build_object(
      'event', 'color_lot_created',
      'parent_entity_id', v_parent.id,
      'parent_batch_id', v_parent.batch_id,
      'quantity_used', p_quantity_used,
      'output_quantity', p_output_quantity,
      'unit', v_unit,
      'color', v_color
    ),
    auth.uid()
  );

  perform set_config('namah_trace.allocation_rpc', coalesce(v_previous_rpc_marker, ''), true);
  return v_child_id;
end;
$$;

revoke all on function public.create_colored_material_lot(uuid, text, numeric, numeric, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.create_colored_material_lot(uuid, text, numeric, numeric, text, timestamptz, text)
  to authenticated;

commit;
