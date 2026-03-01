# ADR-011: Phase 6 Deployment Configuration

## Status: Accepted

## Decisions
- Railway: NestJS backend with Dockerfile
- Vercel: Next.js admin portal (Root: apps/admin)
- Database: Supabase Transaction Pooler (port 6543, IPv4)
- SSL: rejectUnauthorized: false for Supabase pooler
- JWT: JWT_ACCESS_SECRET + JWT_REFRESH_SECRET via Railway env vars
- CORS: ALLOWED_ORIGINS via Railway env var

## Key Fixes
- uuid replaced with crypto.randomUUID (ESM compatibility)
- CommonModule @Global for JwtGuard DI
- DispatchModule imports BookingModule
- DriverModule created and registered
- Booking transition: only emit outbox events for CONFIRMED/COMPLETED/CANCELLED/NO_SHOW
