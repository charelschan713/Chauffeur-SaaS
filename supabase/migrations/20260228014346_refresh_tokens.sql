create table if not exists public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  token_hash text not null unique,
  rotated_from text,
  last_used_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_refresh_tokens_user
  on public.refresh_tokens(user_id);
create index if not exists idx_refresh_tokens_hash
  on public.refresh_tokens(token_hash);

alter table public.refresh_tokens enable row level security;

drop policy if exists platform_admin_bypass_refresh_tokens
  on public.refresh_tokens;
create policy platform_admin_bypass_refresh_tokens
on public.refresh_tokens for all
using (exists (
  select 1 from public.users
  where id = auth.uid()
  and is_platform_admin = true
));
