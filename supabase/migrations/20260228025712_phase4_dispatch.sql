ALTER TYPE assignment_status_enum 
  ADD VALUE IF NOT EXISTS 'OFFERED';
ALTER TYPE assignment_status_enum 
  ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE assignment_status_enum 
  ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE assignment_status_enum 
  ADD VALUE IF NOT EXISTS 'JOB_STARTED';
ALTER TYPE assignment_status_enum 
  ADD VALUE IF NOT EXISTS 'JOB_COMPLETED';

create table if not exists public.dispatch_driver_status (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id)
    on delete cascade,
  driver_id uuid not null references public.users(id)
    on delete cascade,
  status text not null default 'OFFLINE'
    check (status in (
      'OFFLINE','AVAILABLE','ON_JOB','UNAVAILABLE'
    )),
  notes text,
  updated_at timestamptz not null default now(),
  unique (tenant_id, driver_id)
);

create table if not exists public.dispatch_driver_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id)
    on delete cascade,
  driver_id uuid not null references public.users(id)
    on delete cascade,
  shift_start_at timestamptz not null,
  shift_end_at timestamptz not null,
  timezone text not null default 'UTC',
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_shifts_driver
  on public.dispatch_driver_shifts(driver_id);
create index if not exists idx_shifts_start
  on public.dispatch_driver_shifts(shift_start_at);

create table if not exists 
  public.dispatch_assignment_activity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id)
    on delete cascade,
  assignment_id uuid not null 
    references public.assignments(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'CREATED','OFFERED','DRIVER_ACCEPTED',
    'DRIVER_DECLINED','TIMEOUT','CANCELLED',
    'JOB_STARTED','JOB_COMPLETED'
  )),
  performed_by uuid references public.users(id),
  performed_at timestamptz not null default now(),
  reason text,
  metadata jsonb
);

create index if not exists idx_activity_assignment
  on public.dispatch_assignment_activity(assignment_id);

alter table public.dispatch_driver_status 
  enable row level security;
alter table public.dispatch_driver_shifts 
  enable row level security;
alter table public.dispatch_assignment_activity 
  enable row level security;

drop policy if exists tenant_isolation_driver_status 
  on public.dispatch_driver_status;
create policy tenant_isolation_driver_status
on public.dispatch_driver_status for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_isolation_driver_shifts
  on public.dispatch_driver_shifts;
create policy tenant_isolation_driver_shifts
on public.dispatch_driver_shifts for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists tenant_isolation_assignment_activity
  on public.dispatch_assignment_activity;
create policy tenant_isolation_assignment_activity
on public.dispatch_assignment_activity for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists platform_admin_bypass_driver_status
  on public.dispatch_driver_status;
create policy platform_admin_bypass_driver_status
on public.dispatch_driver_status for all
using (exists (select 1 from public.users 
  where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_driver_shifts
  on public.dispatch_driver_shifts;
create policy platform_admin_bypass_driver_shifts
on public.dispatch_driver_shifts for all
using (exists (select 1 from public.users 
  where id = auth.uid() and is_platform_admin = true));

drop policy if exists platform_admin_bypass_assignment_activity
  on public.dispatch_assignment_activity;
create policy platform_admin_bypass_assignment_activity
on public.dispatch_assignment_activity for all
using (exists (select 1 from public.users 
  where id = auth.uid() and is_platform_admin = true));

ALTER TABLE public.assignments 
  ADD COLUMN IF NOT EXISTS offered_at timestamptz;
