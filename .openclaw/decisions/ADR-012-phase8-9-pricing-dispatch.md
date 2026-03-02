# ADR-012: Phase 8-9 Pricing + Dispatch Architecture

## Status: Accepted

## Phase 8 — Composable Pricing Engine
- platform_vehicles: platform-level vehicle registry
- tenant_vehicles: tenant fleet (linked to platform)
- tenant_service_classes: client-facing service names
- tenant_service_class_vehicles: service ↔ vehicle mapping
- service_class_pricing_items: composable pricing items (BASE_FARE / PER_KM / DRIVING_TIME / WAITING_TIME / HOURLY_RATE / WAYPOINT / BABYSEAT)
- pricing_zones: flat rate zone override
- PricingResolver: deterministic sync pipeline
- pricing_snapshot: immutable, write-once financial record

## Phase 9 — Cost-Aware Dispatch
- EligibilityResolver: service_class → vehicle → driver
- Auto Dispatch: selects most recently available eligible driver
- GET /dispatch/eligible-drivers/:bookingId
- POST /dispatch/auto
- selectionReason: MOST_RECENTLY_AVAILABLE (V1)

## Key Principles
- pricing_snapshot NEVER recalculated after booking created
- Dispatch only offers eligible drivers (service class match)
- V1: GPS replaced by last_seen_at ordering
- AdjustmentResolver: stub for future AI surge
