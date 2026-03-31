create table if not exists tenant_permissions (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  can_push_jobs boolean default false,
  can_partner_assign boolean default false,
  can_driver_app_access boolean default false,
  can_api_access boolean default false,
  updated_at timestamptz default now()
);

create index if not exists idx_tenant_permissions_tenant
  on tenant_permissions(tenant_id);
