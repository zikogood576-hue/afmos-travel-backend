-- Phase 2 - Schéma minimal (PostgreSQL / Supabase)
-- Remarque: à exécuter dans Supabase SQL editor.

create extension if not exists "uuid-ossp";

do $$ begin
  create type user_role as enum ('ADMIN', 'TECHNICIAN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type travel_status as enum ('DRAFT', 'SUBMITTED', 'PENDING_VALIDATION', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

-- Villes du Maroc (OBLIGATOIRE) : pilier anti-fraude
create table if not exists public.cities (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  region text null,
  lat numeric(10, 7) not null,
  lon numeric(10, 7) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  full_name text not null,
  role user_role not null,
  access_code_hash text not null,
  is_active boolean not null default true,
  last_login_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_declarations (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references public.users(id),
  status travel_status not null default 'DRAFT',

  departure_city_id uuid not null references public.cities(id),
  destination_city_id uuid not null references public.cities(id),

  mission_date date not null,
  comments text null,

  submission_lat numeric(10, 7) null,
  submission_lon numeric(10, 7) null,

  distance_km numeric(10, 3) null,
  lunch_selected boolean not null default false,
  dinner_selected boolean not null default false,

  -- Montants du conducteur (créateur) uniquement
  distance_amount_mad numeric(10, 2) not null default 0,
  meal_amount_mad numeric(10, 2) not null default 0,
  total_amount_mad numeric(10, 2) not null default 0,

  is_suspicious boolean not null default false,
  suspicion_reason text null,

  submitted_at timestamptz null,
  validated_by_id uuid null references public.users(id),
  validated_at timestamptz null,
  rejected_by_id uuid null references public.users(id),
  rejected_at timestamptz null,
  rejection_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Collègues : frais repas uniquement (aucun remboursement distance)
create table if not exists public.travel_colleagues (
  id uuid primary key default uuid_generate_v4(),
  travel_declaration_id uuid not null references public.travel_declarations(id) on delete cascade,
  user_id uuid not null references public.users(id),
  lunch_selected boolean not null default false,
  dinner_selected boolean not null default false,
  meal_amount_mad numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (travel_declaration_id, user_id)
);

create table if not exists public.fraud_alerts (
  id uuid primary key default uuid_generate_v4(),
  travel_declaration_id uuid not null references public.travel_declarations(id) on delete cascade,
  alert_type text not null,
  severity text not null,
  description text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by_id uuid null references public.users(id),
  resolution_note text null
);

create table if not exists public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid null references public.users(id),
  action_type text not null,
  entity_type text null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_travel_creator on public.travel_declarations(creator_id);
create index if not exists idx_travel_status on public.travel_declarations(status);
create index if not exists idx_travel_suspicious on public.travel_declarations(is_suspicious);
create index if not exists idx_logs_created_at on public.activity_logs(created_at);

