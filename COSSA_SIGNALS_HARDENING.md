# Cossa Signals hardening handoff

Prepared 2026-09-07 from the GitHub/Lovable export. This package does not apply migrations to a live Supabase project and does not deploy production.

## Changes included

- `.env` is excluded from the handoff package and `.gitignore` now blocks environment files. `.env.example` contains public-only placeholders.
- Added additive migration `20260907043000_security_entitlements_and_demo_integrity.sql`.
- Signal visibility is enforced by database RLS using the global `signals_enabled` control plus tier delays/history windows: Free 15 minutes / 7 days, Basic 2 minutes / 365 days, Pro immediate/full history.
- Signal indicator, council vote and risk-check evidence can no longer be read when the parent signal is not visible to that user.
- Demo data-health and service-heartbeat telemetry now has an explicit `is_demo` field.
- The dashboard does not report seeded demo telemetry as a healthy live feed; it shows `Demo only` until real health rows exist.
- Live/history queries periodically refetch so delayed Free/Basic signals appear when their server-side delay window expires.

## Important remaining production work

1. Apply and review the new migration in a non-production/test branch first, then production after verification.
2. Regenerate Supabase TypeScript types after the migration; this package includes the equivalent manual field additions so the source remains coherent until regeneration.
3. Move Python/Deriv workers to service-role/server-side credentials only. Never expose service-role, Deriv API tokens, payment secrets, or webhook secrets in `VITE_*` variables.
4. Replace demo telemetry by upserting `data_health.is_demo=false` and `service_heartbeats.is_demo=false` from real workers.
5. Implement Pro-only AI-field delivery through a server/RPC boundary before billing goes live; RLS currently controls row timing/history but PostgreSQL row policies do not provide field-level masking.
6. Keep real-money execution disabled. Current architecture should remain research/paper-first until forward validation, costs, risk limits and compliance are complete.

## Verification checklist

- Free user cannot read a signal newer than 15 minutes and cannot read history older than 7 days.
- Basic user cannot read a signal newer than 2 minutes and cannot read history older than 365 days.
- Pro user can read current authorized signals.
- When `platform_controls.signals_enabled=false`, non-staff signal reads return no rows.
- Staff can inspect signals while the kill switch is active.
- Child indicator/vote/risk-check rows follow the parent signal visibility rule.
- Demo telemetry displays `Demo data`; live worker telemetry does not.
- `npm run build` and `npm run lint` pass in an environment with dependencies installed.
