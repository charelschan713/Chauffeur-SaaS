# ADR-001: Stripe Connect Per Tenant

## Status
Accepted – Phase 3 Payment Domain

## Context
- Chauffeur Solutions operates as a multi-tenant SaaS.
- Each tenant must own its financial relationship, payouts, and compliance.
- Booking/Payment events require tenant-scoped Stripe credentials without exposing platform keys.

## Decision
Adopt **Stripe Connect (Standard accounts)** per tenant:
- Tenants onboard via Stripe Connect OAuth.
- Platform stores tenant Stripe account ID + capabilities server-side.
- Payment Domain acts as broker: creates payment intents/captures on behalf of tenant using Connect keys.
- All financial truth remains in Payment Domain tables; UI never trusts client payment state.

## Consequences
- Enables legal separation of payouts per tenant.
- Requires secure storage/rotation of Stripe access tokens (service-role only).
- Webhooks must include tenant context via metadata/outbox correlation.
- Admin portal can only read payment summary exposed by Payment Domain APIs.
