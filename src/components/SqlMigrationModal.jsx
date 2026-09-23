import React, { useState } from 'react'
import { X, Copy, Check, Database, ExternalLink } from 'lucide-react'

const SQL_SCHEMA = `-- ==============================================================================
-- NAMAH TRACE V1 — Production Database Schema
-- Run this script in the Supabase SQL Editor:
-- ==============================================================================

create extension if not exists "uuid-ossp";

-- 1. Profiles & Roles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'operator' check (role in ('admin', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Core Entities (Flat Yarn, Yarn Batch, Rope Batch)
create table if not exists public.entities (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('flat_yarn', 'yarn', 'rope')),
  batch_id text not null unique,
  supplier text,
  treatment text,
  quantity numeric,
  unit text,
  status text check (status in ('In Progress', 'Completed')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Entity Genealogy (Directed Lineage Graph)
create table if not exists public.entity_genealogy (
  id uuid primary key default uuid_generate_v4(),
  parent_entity_id uuid not null references public.entities(id) on delete cascade,
  child_entity_id uuid not null references public.entities(id) on delete cascade,
  quantity_used numeric,
  unit text,
  remarks text,
  created_at timestamptz not null default now(),
  unique (parent_entity_id, child_entity_id)
);

-- 4. Parameters & Specifications
create table if not exists public.entity_parameters (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  name text not null,
  value text not null,
  unit text,
  remarks text,
  created_at timestamptz not null default now()
);

-- 5. Tests & Observations
create table if not exists public.entity_tests (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  test_name text not null,
  value text not null,
  unit text,
  remarks text,
  result text default 'Pass',
  performed_by uuid references public.profiles(id) on delete set null,
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 6. Processes & Lifecycle Records
create table if not exists public.entity_processes (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  process_name text not null,
  specification text,
  remarks text,
  performed_by uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 7. Evidence & Attachments
create table if not exists public.entity_evidence (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  process_id uuid references public.entity_processes(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 8. Audit History Logs
create table if not exists public.entity_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  action text not null,
  field_name text,
  old_value text,
  new_value text,
  details jsonb,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.entities enable row level security;
alter table public.entity_genealogy enable row level security;
alter table public.entity_parameters enable row level security;
alter table public.entity_tests enable row level security;
alter table public.entity_processes enable row level security;
alter table public.entity_evidence enable row level security;
alter table public.entity_audit_logs enable row level security;

create policy "Authenticated users can read entities" on public.entities for select to authenticated using (true);
create policy "Authenticated users can manage entities" on public.entities for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage genealogy" on public.entity_genealogy for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage parameters" on public.entity_parameters for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage tests" on public.entity_tests for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage processes" on public.entity_processes for all to authenticated using (true) with check (true);
create policy "Authenticated users can manage evidence" on public.entity_evidence for all to authenticated using (true) with check (true);
create policy "Authenticated users can insert audit logs" on public.entity_audit_logs for insert to authenticated with check (true);`

export function SqlMigrationModal({ onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCHEMA)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog sql-modal">
        <div className="modal-head">
          <div className="modal-title-with-icon">
            <Database size={20} className="panel-icon text-navy" />
            <div>
              <h2>Supabase PostgreSQL Schema (V1)</h2>
              <p className="modal-subtitle">
                Paste and run this in your Supabase SQL Editor to provision the V1 database.
              </p>
            </div>
          </div>
          <button className="icon-button modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="sql-box-header">
          <span>PostgreSQL Schema · Tables & RLS Policies</span>
          <button className="primary-button copy-sql-btn" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
          </button>
        </div>

        <pre className="sql-code-block">
          <code>{SQL_SCHEMA}</code>
        </pre>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="primary-button" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy SQL Script'}
          </button>
        </div>
      </div>
    </div>
  )
}
