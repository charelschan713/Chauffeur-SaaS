# ADR-003: JWT Tenant Context Enforcement

## Status
Accepted – Phase 1 Auth

## Context
- SaaS must isolate tenant data; relying on request body is insecure.
- RLS policies depend on `tenant_id` being injected at the DB session level.
- Refresh token rotation + tenant switching require authoritative tenant context.

## Decision
- Access tokens include `tenant_id`, `isPlatformAdmin`, and `roles` claims.
- NestJS `TenantContextMiddleware` sets `app.tenant_id` via `set_config` for each request.
- Controllers/services must read tenant context from JWT (via `@CurrentUser('tenant_id')`).
- Switching tenants revokes existing refresh tokens and issues new tenant-scoped tokens.

## Consequences
- Prevents tenant spoofing because server ignores user-provided tenant identifiers.
- Simplifies RLS: Postgres policies read `current_setting('app.tenant_id')`.
- Requires rigorous token rotation + logout-all on tenant switch.
- Platform admins bypass RLS via `isPlatformAdmin` checks but still log actions per tenant.
