# Cossa Signals — roadmap

## Done
- Database foundation, RLS, demo seed (is_demo=true)
- Design system, hooks, types, badges/panels, Smart Signal Matrix
- App shell, landing, auth, dashboard, matrix, signals, signal detail, performance

## In progress (this turn)
- Markets (/markets, /markets/forex, /markets/synthetics), instrument detail
- Watchlist (persisted add/remove)
- Academy + article pages, Pricing, Legal
- Account (profile, subscription, alert preferences)
- Admin section (signals, instruments, strategies, performance, system, users, billing, audit)

## Integration brief follow-ups
- Demo vs live separation on performance, data health, service heartbeats
- Honest empty/error states everywhere ("Awaiting signal engine", "Unable to load…")
- Realtime kept to one channel with cleanup; refetch fallback retained
- Kill switch respected via platform_controls
- Production build + typecheck must pass
- Blocker to report: backend project ref is managed by Lovable Cloud env vars; cannot be
  repointed to an externally created Supabase project from code.
