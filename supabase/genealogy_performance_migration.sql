create or replace function public.get_connected_genealogy(p_entity_id uuid)
returns table (
  id uuid,
  parent_id uuid,
  parent_batch_id text,
  parent_type text,
  child_id uuid,
  child_batch_id text,
  child_type text,
  quantity_used numeric,
  unit text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive connected(entity_id) as (
    select p_entity_id
    union
    select adjacent.entity_id
    from connected current_entity
    cross join lateral (
      select genealogy.child_entity_id as entity_id
      from public.entity_genealogy genealogy
      where genealogy.parent_entity_id = current_entity.entity_id
      union
      select genealogy.parent_entity_id as entity_id
      from public.entity_genealogy genealogy
      where genealogy.child_entity_id = current_entity.entity_id
    ) adjacent
  )
  select
    genealogy.id,
    genealogy.parent_entity_id,
    parent.batch_id,
    parent.type,
    genealogy.child_entity_id,
    child.batch_id,
    child.type,
    genealogy.quantity_used,
    genealogy.unit
  from public.entity_genealogy genealogy
  join connected parent_connected on parent_connected.entity_id = genealogy.parent_entity_id
  join connected child_connected on child_connected.entity_id = genealogy.child_entity_id
  join public.entities parent on parent.id = genealogy.parent_entity_id
  join public.entities child on child.id = genealogy.child_entity_id;
$$;

grant execute on function public.get_connected_genealogy(uuid) to authenticated;
