# Deriv ingestion runtime

Cossa Signals must ingest every enabled Deriv mapping without a hard-coded instrument list.

Runtime rules:

- Load enabled mappings from `instrument_provider_mappings`.
- Skip disabled canonical instruments.
- Isolate per-symbol failures so one bad symbol does not cancel the batch.
- Use bounded concurrency, default 3, configurable with `DERIV_INGESTION_CONCURRENCY`, hard-capped at 6.
- Keep provider secrets in server environment variables, never provider rows.
- Return attempted, succeeded, failed, concurrency, and per-instrument results.

Verified baseline on 2026-09-18: seven enabled Deriv mappings exist: `1HZ75V`, `R_10`, `R_25`, `R_50`, `R_75`, `R_100`, and `STEPIDX`.

Promotion gate: formatting, typecheck, tests and production build must pass; endpoint authorization must remain unchanged; one protected invocation must attempt all seven enabled mappings; successful instruments must update live timestamps and clear demo state.
