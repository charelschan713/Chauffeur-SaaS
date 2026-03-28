-- Add city targeting for surcharges (time/holiday)
create table if not exists public.tenant_surcharge_cities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  surcharge_type text not null check (surcharge_type in ('TIME','HOLIDAY')),
  surcharge_id uuid not null,
  city_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenant_surcharge_cities_tenant on public.tenant_surcharge_cities(tenant_id);
create index if not exists idx_tenant_surcharge_cities_surcharge on public.tenant_surcharge_cities(surcharge_type, surcharge_id);
create index if not exists idx_tenant_surcharge_cities_city on public.tenant_surcharge_cities(city_id);
