create extension if not exists pg_trgm;

create index if not exists idx_entities_batch_id_trgm
  on public.entities using gin (batch_id gin_trgm_ops);

create index if not exists idx_entities_supplier_trgm
  on public.entities using gin (supplier gin_trgm_ops);

create index if not exists idx_entities_treatment_trgm
  on public.entities using gin (treatment gin_trgm_ops);

create index if not exists idx_entities_notes_trgm
  on public.entities using gin (notes gin_trgm_ops);

create index if not exists idx_entity_parameters_name_trgm
  on public.entity_parameters using gin (name gin_trgm_ops);

create index if not exists idx_entity_parameters_value_trgm
  on public.entity_parameters using gin (value gin_trgm_ops);


