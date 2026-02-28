# ADR-002: Transactional Outbox Pattern

## Status
Accepted – Phase 2.1 Dispatch/Booking

## Context
- Domains must emit events reliably across services (Booking → Dispatch → Notification).
- Direct event publishing risks loss on failure and breaks idempotency.
- Multi-tenant isolation requires auditable event history.

## Decision
Implement a transactional outbox per domain service:
- Domain mutations insert into a shared `outbox` table within the same DB transaction.
- Background workers (NestJS queues/cron) poll outbox, publish events, mark delivered.
- Events include tenant_id, aggregate_id, schema version for consumers.

## Consequences
- Guarantees at-least-once delivery while preserving domain boundaries.
- Consumers must be idempotent and track last processed event.
- Adds worker infrastructure but enables replay/testing.
- Enables governance auditing (who emitted, payload hash, timestamps).
