# ⚠️ INACTIVE — DO NOT EDIT

`src/modules/` contains **legacy/abandoned module scaffolding** from an earlier architecture design.

## Status: UNREGISTERED — NOT LOADED AT RUNTIME

These modules are **not imported** by `src/app.module.ts` or any other active source file.

Verified: 2026-03-09
- Zero `import ... from '*/modules/*'` references outside this directory
- No `require()` calls
- No tsconfig path aliases pointing here
- No CI/test script references

## Active module location

The production NestJS modules live in **`src/<module-name>/`** (one level up):
```
src/auth/         src/booking/         src/payment/
src/dispatch/     src/driver/          src/pricing/
src/customer-portal/  src/notification/    src/public/
(etc.)
```

## Do NOT delete yet

Before deletion, confirm:
1. No future dev has added imports since this file was written (re-run grep)
2. Product owner has reviewed and approved archive

## Safe archive command (when approved)

```bash
git mv src/modules src/_archive_modules
git commit -m "chore: archive inactive src/modules/ directory"
```
