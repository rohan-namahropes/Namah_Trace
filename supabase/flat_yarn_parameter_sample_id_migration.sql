-- Adds optional cone/sample labels to parameter records.
-- Apply after schema.sql.

alter table public.entity_parameters
  add column if not exists sample_id text;
