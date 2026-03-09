# ⚠️ LEGACY ROUTE FAMILY — /admin/*

## Status: UNSECURED DUPLICATES

The `/admin/*` route family was an early platform admin section.

## Security Problem

`apps/admin/app/admin/layout.tsx` uses `AdminLayout` only — **no `isPlatformAdmin` check**.  
Any tenant admin with a valid `accessToken` can access these routes and call platform-level APIs.

## Active Replacement

| Legacy route | Active replacement | Guard |
|---|---|---|
| `/admin/dashboard` | `/overview` | ✅ isPlatformAdmin |
| `/admin/tenants` | `/tenants` | ✅ isPlatformAdmin |
| `/admin/bookings` | Tenant: `/bookings` | ✅ tenant guard |
| `/admin/drivers` | Tenant: `/drivers` | ✅ tenant guard |
| `/admin/customers` | Tenant: `/customers` | ✅ tenant guard |
| `/admin/dispatch` | Tenant: `/dispatch` | ✅ tenant guard |
| `/admin/pricing` | Tenant: `/pricing/*` | ✅ tenant guard |
| `/admin/settings` | Tenant: `/settings/*` | ✅ tenant guard |
| `/admin/vehicles` | Tenant: `/vehicles` | ✅ tenant guard |
| `/admin/discounts` | Tenant: `/discounts` | ✅ tenant guard |

## Disposition

- `/admin/dashboard` → redirects to `/overview` ✅ DONE
- `/admin/tenants` → redirects to `/tenants` ✅ DONE  
- Remaining pages → marked legacy, can be deleted when no external links exist

## Do NOT add new features here
