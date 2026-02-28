-- ============================================
-- Phase 0 - Database Foundation (Final)
-- ============================================

create extension if not exists "pgcrypto";

create type tenant_status_enum as enum (
  'pending', 'active', 'suspended', 'archived'
);
create type membership_role_enum as enum (
  'tenant_admin', 'tenant_staff', 'driver', 'passenger'
);
create type membership_status_enum as enum (
  'active', 'invited', 'disabled'
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'UTC',
  currency char(3) not null default 'USD',
  status tenant_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (currency = upper(currency)),
  check (length(currency) = 3)
);
create index idx_tenants_status on public.tenants(status);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role membership_role_enum not null,
  status membership_status_enum not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index idx_memberships_tenant on public.memberships(tenant_id);
create index idx_memberships_user on public.memberships(user_id);

create table public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_features (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, feature_key)
);

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.tenant_features enable row level security;

create or replace function public.current_tenant_id()
returns uuid language sql stable as $$
  select current_setting('app.tenant_id', true)::uuid;
$$;

drop policy if exists tenant_isolation_policy on public.tenants;
create policy tenant_isolation_policy on public.tenants for all
using (id = public.current_tenant_id())
with check (id = public.current_tenant_id());

drop policy if exists membership_isolation_policy on public.memberships;
create policy membership_isolation_policy on public.memberships for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_settings_isolation_policy on public.tenant_settings;
create policy tenant_settings_isolation_policy on public.tenant_settings for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_features_isolation_policy on public.tenant_features;
create policy tenant_features_isolation_policy on public.tenant_features for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists platform_admin_bypass_tenants on public.tenants;
create policy platform_admin_bypass_tenants on public.tenants for all
using (exists (select 1 from public.users
  where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_memberships on public.memberships;
create policy platform_admin_bypass_memberships on public.memberships for all
using (exists (select 1 from public.users
  where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_settings on public.tenant_settings;
create policy platform_admin_bypass_settings on public.tenant_settings for all
using (exists (select 1 from public.users
  where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_features on public.tenant_features;
create policy platform_admin_bypass_features on public.tenant_features for all
using (exists (select 1 from public.users
  where id = auth.uid() and is_platform_admin = true));

insert into public.tenants (id, name, slug, status)
values (
  '11111111-1111-1111-1111-111111111111',
  'Default Tenant', 'default-tenant', 'active'
) on conflict do nothing;

insert into public.tenant_settings (tenant_id, settings)
values (
  '11111111-1111-1111-1111-111111111111',
  '{}'::jsonb
) on conflict do nothing;

insert into public.tenant_features (tenant_id, feature_key, enabled)
values
  ('11111111-1111-1111-1111-111111111111', 'dispatch', true),
  ('11111111-1111-1111-1111-111111111111', 'billing', true)
on conflict do nothing;
