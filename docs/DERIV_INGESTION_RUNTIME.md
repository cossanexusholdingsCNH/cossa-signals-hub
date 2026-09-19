# Deriv ingestion runtime

Cossa Signals must ingest every enabled Deriv mapping without a hard-coded instrument list.

Runtime rules:

- Load enabled mappings from `instrument_provider_mappings`.
- Skip disabled canonical instruments.
- Isolate per-symbol failures so one bad symbol does not cancel the batch.
- Use bounded concurrency, default 3, configurable with `DERIV_INGESTION_CONCURRENCY`, hard-capped at 6.
- Keep provider secrets in server environment variables, never provider rows.
- Return attempted, succeeded, failed, concurrency, and per-instrument results.
- Do not document a fixed mapping count as the runtime source of truth. The registry is dynamic and the database decides which mappings are enabled.

## Production trigger

Primary protected endpoint:

`GET /api/deriv-ingest`

Authorization remains `Authorization: Bearer <CRON_SECRET>` and must fail closed when `CRON_SECRET` is missing or incorrect.

Production scheduling is provided by `.github/workflows/deriv-production-scheduler.yml` on a five-minute cadence. The workflow:

- reads `CRON_SECRET` only from GitHub Actions secrets;
- optionally reads `DERIV_INGESTION_URL` from GitHub Actions variables, otherwise uses the current Vercel production endpoint;
- prevents overlapping scheduler runs through GitHub Actions concurrency;
- requires a successful HTTP response with `ok=true`, `attempted>0`, and `succeeded>0`;
- records only non-sensitive attempted/succeeded/failed/concurrency counts in the job summary.

The external scheduler may remain as an additional idempotent trigger, but production continuity must not depend on one external scheduler service. Signal evidence dedupe and normalized market-data uniqueness constraints protect repeated closed-window evaluations.

## Promotion gate

Formatting, typecheck, tests and production build must pass. Endpoint authorization must remain unchanged. A protected invocation must attempt every currently enabled Deriv mapping. Successful instruments must update live timestamps, clear demo state where applicable, persist immutable signal evidence, and persist deterministic market-structure snapshots when the structure migration is present.
