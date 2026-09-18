# Cossa Signals — Real Data Engine Rollout

## Current safety position

- Production Supabase project: `bbulwwrvduyzvzwjxnmi` (`cossa-signals`).
- GitHub work is isolated on `upgrade/real-data-engine-wiring`.
- No real-market migration is to be applied to production until schema review, build/typecheck and CEO approval are complete.
- Demo rows remain demo rows. Real workers must always write `is_demo = false`.
- Provider secrets must be server environment variables/secrets, never rows in `market_data_providers`.

## Product scope correction

Cossa Signals is not a read-only market dashboard. Its real signal output must produce actionable trade plans from real market data, including:

- BUY / SELL / WAIT / NO-TRADE direction;
- entry price and entry zone;
- stop-loss / invalidation level;
- TP1, TP2 and TP3;
- risk/reward ratio;
- confidence score and grade;
- market regime and supporting indicators;
- explicit risk-gate result and no-trade reasons;
- live signal lifecycle tracking: pending, active, targets hit, stopped, expired, invalidated and closed;
- outcome/performance measurement against the original signal.

The existing `signals` schema already contains these fields and remains the canonical trade-plan output layer.

The market-data adapter itself remains separated from trade-plan generation: provider adapters acquire/normalize market evidence; the deterministic signal/risk engine decides BUY/SELL/WAIT and calculates entry/SL/TP. This prevents provider-specific code from becoming the trading strategy.

Cossa Signals may support paper/simulated execution for validation. Direct placement of real-money broker orders is a separate execution capability and is not part of this rollout.

## Migration drift decision

The repository contains two 2026-09-11 migrations that are not applied remotely. They introduce `current_tier()` / `can_view_signal()` and replace signal read policies with different entitlement delays. Production already uses the stronger 2026-09-07 `effective_subscription_tier()` / `can_read_signal()` path, including the global `signals_enabled` kill switch.

Do not apply the 2026-09-11 entitlement migrations as-is. Reconcile them in a dedicated security migration instead of allowing an older/parallel entitlement model to replace the production rule.

## Real market-data architecture

1. `market_data_providers` — editable provider registry and circuit-breaker state.
2. `instrument_provider_mappings` — canonical Cossa instrument to provider-symbol mapping.
3. `market_ticks` — normalized raw tick evidence.
4. `market_candles` — normalized OHLC evidence for deterministic analysis/backtests.
5. `market_data_ingestion_runs` — provider health and ingestion audit trail.
6. `signal_engine_runs` — decision/no-trade audit trail.
7. Existing `signals`, `signal_indicators`, `signal_votes`, `risk_checks`, `market_regimes` and `performance_snapshots` remain the product intelligence and actionable trade-plan layer.

## Deriv adapter

`src/server/market-data/deriv.ts` acquires and normalizes Deriv market data for the signal engine.

Supported foundation operations:

- active symbol discovery;
- single live tick snapshot;
- historical OHLC candle retrieval;
- compatibility with current and legacy active-symbol response names during the API transition.

BUY/SELL/entry/SL/TP decisions must be produced by the signal engine from normalized evidence, not hard-coded inside the Deriv transport adapter.

## Mandatory gates before production migration

1. Inspect generated SQL against the live schema.
2. Typecheck/build the branch.
3. Add deterministic unit tests for provider normalization and signal calculations.
4. Confirm Deriv symbol mappings from live `active_symbols`; do not hard-code guessed synthetic symbols.
5. Add ingestion worker with idempotent writes, retries, timeout, circuit breaker and heartbeats.
6. Backfill a bounded candle sample into a non-production/test database first.
7. Validate timestamps, OHLC invariants, duplicates, stale-data detection and provider outage behavior.
8. Build deterministic indicators, market-regime detection, BUY/SELL/WAIT decision logic and risk gates before adding AI reasoning.
9. Generate entry, stop-loss, TP1/TP2/TP3 and risk/reward deterministically and store the complete evidence trail.
10. Validate signal lifecycle and outcomes in paper mode against minimum sample thresholds before claiming live-verified performance.
11. Apply production migration only after explicit CEO approval.

## Provider strategy

Deriv is the first adapter because Cossa Signals requires Deriv synthetic indices. Forex should use a separate provider adapter/fallback architecture rather than pretending one feed is sufficient for every asset class. The provider registry must remain editable so providers can be replaced without rewriting the signal engine.
