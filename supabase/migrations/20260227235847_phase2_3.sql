-- ============================================
-- Phase 2 + 2.1 + 3 migrations
-- ============================================

-- Phase 2 types

do $$ begin
  create type booking_source_enum as enum (
    'ADMIN','TENANT_API','WIDGET','TRANSFER_IN','IMPORT'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type operational_status_enum as enum (
    'DRAFT','PENDING','CONFIRMED','ASSIGNED',
    'IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status_enum as enum (
    'UNPAID','AUTHORIZED','PAID',
    'PARTIALLY_REFUNDED','REFUNDED','FAILED','CANCELLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_status_enum as enum (
    'PENDING','ACCEPTED','REJECTED','CANCELLED','COMPLETED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type_enum as enum (
    'BOOKING_INFO_V1','BOOKING_INFO_V2',
    'FINAL_INVOICE','REFUND_NOTE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_generated_by_enum as enum (
    'SYSTEM','ADMIN','PAYMENT_EVENT'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_reference text not null,
  booking_source booking_source_enum not null,
  operational_status operational_status_enum not null default 'DRAFT',
  payment_status payment_status_enum not null default 'UNPAID',
  customer_first_name text not null,
  customer_last_name text not null,
  customer_email text not null,
  customer_phone_country_code text,
  customer_phone_number text,
  pickup_address_text text not null,
  pickup_lat numeric,
  pickup_lng numeric,
  pickup_place_id text,
  dropoff_address_text text not null,
  dropoff_lat numeric,
  dropoff_lng numeric,
  dropoff_place_id text,
  waypoints jsonb not null default '[]',
  pickup_at_utc timestamptz not null,
  timezone text not null,
  estimated_duration_seconds integer,
  passenger_count integer not null default 1,
  luggage_count integer not null default 0,
  special_requests text,
  base_fare_minor bigint not null default 0,
  surcharge_total_minor bigint not null default 0,
  tax_total_minor bigint not null default 0,
  discount_total_minor bigint not null default 0,
  total_price_minor bigint not null default 0,
  currency char(3) not null default 'AUD',
  client_request_id text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, booking_reference),
  unique (tenant_id, client_request_id)
);

create index if not exists idx_bookings_tenant
  on public.bookings(tenant_id);
create index if not exists idx_bookings_status
  on public.bookings(operational_status);
create index if not exists idx_bookings_pickup
  on public.bookings(pickup_at_utc);

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  previous_status operational_status_enum,
  new_status operational_status_enum not null,
  triggered_by uuid references public.users(id),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bsh_booking
  on public.booking_status_history(booking_id);

create table if not exists public.booking_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  document_type document_type_enum not null,
  version integer not null default 1,
  file_url text,
  generated_by document_generated_by_enum not null,
  generated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  driver_id uuid,
  vehicle_id uuid,
  status assignment_status_enum not null default 'PENDING',
  assigned_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_booking
  on public.assignments(booking_id);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_request_id text not null,
  booking_id uuid,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  unique (tenant_id, client_request_id)
);

create index if not exists idx_idempotency_expires
  on public.idempotency_keys(expires_at);

alter table public.bookings enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.booking_documents enable row level security;
alter table public.assignments enable row level security;
alter table public.idempotency_keys enable row level security;

-- RLS policies Phase 2

drop policy if exists tenant_isolation_bookings on public.bookings;
create policy tenant_isolation_bookings on public.bookings for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_isolation_booking_history on public.booking_status_history;
create policy tenant_isolation_booking_history on public.booking_status_history for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_isolation_booking_docs on public.booking_documents;
create policy tenant_isolation_booking_docs on public.booking_documents for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_isolation_assignments on public.assignments;
create policy tenant_isolation_assignments on public.assignments for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_isolation_idempotency on public.idempotency_keys;
create policy tenant_isolation_idempotency on public.idempotency_keys for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists platform_admin_bypass_bookings on public.bookings;
create policy platform_admin_bypass_bookings on public.bookings for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_booking_history on public.booking_status_history;
create policy platform_admin_bypass_booking_history on public.booking_status_history for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_booking_docs on public.booking_documents;
create policy platform_admin_bypass_booking_docs on public.booking_documents for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_assignments on public.assignments;
create policy platform_admin_bypass_assignments on public.assignments for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_idempotency on public.idempotency_keys;
create policy platform_admin_bypass_idempotency on public.idempotency_keys for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

-- Phase 2.1 Outbox

create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  event_schema_version integer not null default 1,
  payload jsonb not null,
  status text not null default 'PENDING',
  retry_count integer not null default 0,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint outbox_status_check
    check (status in ('PENDING','PROCESSING','PUBLISHED','FAILED'))
);

create index if not exists idx_outbox_status_available
  on public.outbox_events(status, available_at);
create index if not exists idx_outbox_tenant
  on public.outbox_events(tenant_id);
create index if not exists idx_outbox_aggregate
  on public.outbox_events(aggregate_id);

alter table public.outbox_events enable row level security;

drop policy if exists tenant_isolation_outbox_events on public.outbox_events;
create policy tenant_isolation_outbox_events on public.outbox_events for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists platform_admin_bypass_outbox_events on public.outbox_events;
create policy platform_admin_bypass_outbox_events on public.outbox_events for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

-- Phase 3 Payment Domain

do $$ begin
  create type payment_type_enum as enum ('INITIAL','ADJUSTMENT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status_full_enum as enum (
    'UNPAID','AUTHORIZATION_PENDING','AUTHORIZED',
    'CAPTURE_PENDING','PAID','PARTIALLY_REFUNDED',
    'REFUNDED','FAILED','CANCELLED'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stripe_account_id text not null,
  stripe_payment_intent_id text not null,
  payment_type payment_type_enum not null,
  currency char(3) not null,
  amount_authorized_minor bigint not null default 0,
  amount_captured_minor bigint not null default 0,
  amount_refunded_minor bigint not null default 0,
  payment_status payment_status_full_enum not null default 'UNPAID',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, stripe_payment_intent_id)
);

create index if not exists idx_payments_booking
  on public.payments(booking_id);
create index if not exists idx_payments_status
  on public.payments(payment_status);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_email text not null,
  stripe_account_id text not null,
  stripe_customer_id text not null,
  stripe_payment_method_id text not null,
  brand text,
  last4 text,
  expiry_month integer,
  expiry_year integer,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, stripe_payment_method_id)
);

create index if not exists idx_payment_methods_email
  on public.payment_methods(tenant_id, customer_email);

create table if not exists public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stripe_event_id text not null,
  event_type text not null,
  payload_snapshot jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, stripe_event_id)
);

create index if not exists idx_stripe_events_event_id
  on public.stripe_events(stripe_event_id);

alter table public.payments enable row level security;
alter table public.payment_methods enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists tenant_isolation_payments on public.payments;
create policy tenant_isolation_payments on public.payments for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_isolation_payment_methods on public.payment_methods;
create policy tenant_isolation_payment_methods on public.payment_methods for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_isolation_stripe_events on public.stripe_events;
create policy tenant_isolation_stripe_events on public.stripe_events for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists platform_admin_bypass_payments on public.payments;
create policy platform_admin_bypass_payments on public.payments for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_payment_methods on public.payment_methods;
create policy platform_admin_bypass_payment_methods on public.payment_methods for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_stripe_events on public.stripe_events;
create policy platform_admin_bypass_stripe_events on public.stripe_events for all
using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));
