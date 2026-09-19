# Cossa Signals Master Upgrade — Gap Matrix

This matrix maps the current production architecture against the master intelligence/trading specification. It is intentionally evidence-based: a feature is marked **Production Ready** only when its current repository path, production schema and relevant CI gate have been verified. Release-candidate work is not counted as production until merged and deployed.

## Status legend

- **Production Ready** — implemented and used by the current production architecture.
- **Exists but Weak** — implemented, but materially below the target specification.
- **Partially Wired** — schema/UI/service exists but the complete production workflow is not connected.
- **Release Candidate** — implementation and CI are complete on a protected branch, but production promotion or an operational dependency is still outstanding.
- **Missing** — no current implementation was found during repository inspection.
- **Blocked** — must not be enabled until prerequisite safety/validation layers exist.

## Core platform and safety

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Supabase authentication | Production Ready | Auth middleware, RequireAuth/RequireStaff, role tables and RLS exist. | Continue security review before live broker credentials. |
| Market-data provider abstraction | Production Ready for Deriv | Provider registry, instrument mappings, public Deriv adapter and ingestion audit tables exist. | Add other providers behind the same interface later. |
| Deriv synthetic registry | Production Ready | Runtime loads enabled provider mappings instead of a hard-coded instrument list. | Keep mappings and provider-symbol configuration editable. |
| Real candle ingestion | Production Ready code; operations degraded | `market_candles`, ingestion runs, deterministic pipeline and protected ingestion endpoint exist. The external scheduler stopped invoking production after 2026-09-18. | Restore redundant five-minute production scheduling before scanner acceptance testing. |
| Live public tick stream | Production Ready for supported Deriv instruments | Trading terminal uses authenticated provider-symbol lookup and public Deriv tick subscription. | Add server-side stream workers where continuous backend monitoring is required. |
| Data freshness rejection | Production Ready | Signal pipeline and execution risk engine reject stale evidence. | Feed freshness into broader Account Guardian health. |
| Data Confidence | Production Ready foundation | Versioned operational Data Confidence is computed from observable coverage/freshness/continuity, persisted with evidence and enforced separately by execution risk. | Calibrate/extend data-source health factors without converting this into trade-win probability. |
| Demo/Live account separation | Production Ready foundation | `account_environment`, Demo setup and environment-aware execution adapters exist. | Strengthen visual/permission separation before live execution. |
| Execution audit ledger | Production Ready foundation | Orders, events, normalized fills and positions exist in production schema. | Extend journal/reasoning snapshots and reconciliation. |
| Risk engine | Production Ready foundation | Daily loss, position count, risk sizing, stale data, duplicate, Signal Confidence and Data Confidence gates exist. | Add correlated exposure, spread/slippage and Account Guardian layers. |
| Manual emergency stop | Production Ready foundation | Trading-account emergency stop is enforced server-side. | Add broader configurable kill switches and Guardian escalation. |
| Live broker execution | Blocked | Provider-neutral lifecycle exists, but authenticated real-money Deriv/broker adapter is not production-eligible. | Do not activate until permissions, Guardian, live eligibility and re-auth are complete. |
| Auto execution | Blocked / Partially Wired | Environment-neutral `auto` mode exists, but live auto authority is intentionally not enabled. | Build eligibility states, strategy permissions, Guardian and durable worker runtime first. |

## Trading workspace and charts

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Chart-first terminal | Exists but Weak → improving | Trading route, account selector, order ticket and lifecycle panels exist. | Continue dense professional workspace layout. |
| Candlestick + line charts | Production Ready foundation | Real OHLC candles and Candle/Line toggle exist. | Add richer interaction, zoom and durable drawing layer. |
| Live movement | Production Ready foundation | Public live Deriv ticks update the active candle separately from closed-candle intelligence. | Add latency/stream-health telemetry. |
| Indicator overlays | Exists but Weak | EMA20, EMA50, SMA20, RSI14 and ATR14 are available. | Make indicator selection/configuration editable. |
| Drawing tools / trend lines / channels | Missing | No durable drawing model or annotation tools found. | Add after current chart structure is stable. |
| Support/resistance / structure overlays | Production Ready foundation | `structure-v1` deterministically derives confirmed swings, HH/HL or LH/LL state, support/resistance, breakout state and equal-level price references from closed candles; immutable snapshots and chart overlays exist. | Add richer structure taxonomy without claiming unavailable order-book liquidity. |
| Entry/SL/TP overlays | Production Ready foundation | Trading chart supports Entry, SL and TP1 levels. | Add TP2/TP3/trailing and lifecycle markers. |
| Ask Cossa about this candle | Missing | No candle-context AI endpoint found. | Build an immutable candle/context contract before AI explanations. |

## Signals and intelligence

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Deterministic signal engine | Production Ready foundation | EMA/RSI/ATR/MACD engine, evidence fingerprinting and tests exist. | Version and expand evidence carefully. |
| Signal Confidence | Exists but Weak | Confidence is deterministic but not yet outcome-calibrated. | Build calibration datasets before treating it as probability. |
| Data Confidence | Production Ready foundation | Signal/evidence rows carry a separate explainable operational data-quality score and breakdown; low Data Confidence independently blocks execution. | Extend provider-quality inputs while preserving explainability. |
| Signal evidence snapshot | Production Ready foundation | Fingerprinted immutable evidence stores candle range, indicators, reasons, no-trade reasons and Data Confidence. | Add agent/model/reasoning snapshots. |
| Smart Matrix | Exists but Weak | Matrix route and SignalMatrix component exist. | Expand into configurable multi-dimensional intelligence matrix. |
| No-trade decisions | Production Ready foundation | Deterministic engine returns WAIT/no-trade reasons and immutable evidence preserves them. | Use rejected evidence in scanner/journal analytics. |
| Agent votes | Partially Wired | `signal_votes` table and signal-detail UI structures exist. | Build real specialist agent runtimes instead of decorative votes. |
| Multi-agent disagreement | Partially Wired | Schema/UI can display votes, but no full supervisor debate engine exists. | Build structured specialist outputs + Supervisor arbitration. |
| Market regime | Production Ready foundation | Regime is computed and persisted. | Expand regime taxonomy and strategy suitability. |
| Opportunity Scanner | Release Candidate | Protected PR #19 contains deterministic ranking over latest immutable evidence per instrument/timeframe, separate Signal/Data Confidence gates, R:R/freshness gates, exact structure-window matching, qualified + rejected visibility, filters, admin-editable thresholds/weights, tests and green production build. Production controls migration is already validated. | Restore fresh ingestion, merge/deploy PR #19, smoke-test real scanner output, then mark Production Ready foundation. |
| Fundamental/news/calendar intelligence | Missing | No production provider/agent pipeline found. | Add source-provenance provider abstraction after core scanner/risk layers. |
| Sentiment/correlation intelligence | Missing | No production service exists yet. | Add only after source provenance and account exposure model. |

## Accounts, execution and risk

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Demo account bootstrap | Production Ready | Server-controlled virtual account, snapshot and daily baseline exist. | Add clearer account management UI. |
| Demo order execution | Production Ready foundation | Authenticated order endpoint → risk → demo adapter → fill → position. | Expand lifecycle/reconciliation tests. |
| Open position monitoring | Production Ready foundation | Current price, unrealized P/L, TP/SL and manual close are wired. | Move unattended monitoring to durable server workers. |
| Dynamic position sizing | Production Ready foundation | Risk engine sizes from equity/risk/stop distance. | Add exposure/volatility inputs without increasing risk merely because confidence is high. |
| Account Guardian | Missing | Current risk engine is not yet the independent final Guardian. | **Phase 4:** build account health, exposure and independent block/allow contract. |
| Correlated exposure | Missing | No portfolio correlation gate found. | Add portfolio/exposure service before live execution. |
| Spread/slippage gate | Missing / partial | Fill schema records execution, but pre-trade spread/slippage policy is incomplete. | Add provider-aware execution-quality checks. |
| Broker Rules Agent | Missing | No editable broker-rule model found. | Add configuration before external live broker activation. |
| Granular agent permissions | Missing | User roles exist, but trading-agent capability permissions do not. | Required before any autonomous execution. |
| Secure Trading Agent Gateway | Partially Wired | Auth → account → risk → adapter exists, but agent/strategy/Guardian permission stages are absent. | Add stages incrementally; never bypass current risk engine. |
| Live eligibility progression | Missing | No Research→Backtest→Walk-forward→Replay→Demo→Shadow→Limited Live→Proven Live state machine exists. | Required before live strategy execution. |

## Research, performance and learning

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Performance UI | Exists but Weak | Performance route/admin performance exist. | Tie results to real ledger, strategy/model versions and R metrics. |
| Trade Journal | Missing as full lifecycle journal | Execution events exist but not the complete immutable reasoning/review dataset. | Add journal snapshots after intelligence outputs are versioned. |
| Backtesting | Exists but Weak / legacy concepts | Strategy/performance schema exists but no inspected production-grade cost-aware backtest engine. | Build with no look-ahead and explicit costs. |
| Walk-forward validation | Missing | No formal rolling train/validate workflow found. | Build alongside production-grade backtest engine. |
| Replay Lab | Missing | No replay route/engine found. | Build after historical candle/evidence contract is stable. |
| Shadow Trader | Missing | No independent human-vs-Cossa decision ledger found. | Add after journal schema. |
| Counterfactual analysis | Missing | No post-trade counterfactual engine found. | Build only from immutable historical snapshots. |
| Strategy-decay detection | Missing | No rolling deterioration detector found. | Build from versioned strategy outcomes after replay/backtest foundations. |
| Execution-quality intelligence | Missing / partial | Fill/position ledger exists; no dedicated slippage/fill-quality intelligence loop exists. | Build after provider execution metrics are normalized. |
| AI Risk Committee | Missing | No independent multi-agent final risk committee exists. | Build only after Account Guardian + specialist reasoning contracts. |
| Strategy Lab | Partially Wired | Strategies/admin controls exist; natural-language strategy builder/validation pipeline does not. | Build after backtest engine. |
| Academy | Exists but Weak | Academy routes/content exist. | Expand curriculum and connect lessons to actual behaviour/charts. |
| Adaptive coach | Missing | No behavioural learning recommendation engine found. | Build after journal/performance signals are trustworthy. |
| Challenge simulator | Missing | No configurable funded-account simulation engine found. | Build on account-risk primitives, not hard-coded prop rules. |

## Product / SaaS / UX

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Persistent navigation | Production Ready foundation | AppShell exists; scanner navigation is included in PR #19. | Reorganise as product areas grow. |
| Command/search bar | Missing | No natural-language command centre found. | Add after routes/services have stable capabilities. |
| Mobile responsive UI | Exists but Weak | Layout is responsive but trading-specific mobile UX is incomplete. | Add mobile chart/trade/risk navigation later. |
| Subscription architecture | Exists but Weak | Subscription/account/admin billing routes exist. | Revisit entitlements after product tiers are defined. |
| Revenue-ready SaaS | Partially Wired | Auth, profiles and subscription primitives exist; advanced capability gates remain incomplete. | Do not cripple safety/intelligence for monetisation. |

## Phase ordering and current checkpoint

1. **Data Confidence + provenance** — **production foundation complete.**
2. **Professional chart context** — **closed-candle structure foundation complete in production; richer chart interaction remains.**
3. **Opportunity Scanner** — **release candidate on PR #19; acceptance is waiting for fresh production ingestion.**
4. **Account Guardian / exposure intelligence** — correlated exposure, spread/slippage, account health and independent blocking.
5. **Journal + immutable reasoning snapshots** — prerequisite for calibration, Shadow Trader, coaching and counterfactual analysis.
6. **Multi-agent reasoning architecture** — specialist outputs, disagreement and Supervisor decision contract.
7. **Backtest / walk-forward / Replay** — then formal live-eligibility state machine.
8. **Secure agent permissions + broker rules + durable workers** — before limited live automation.
9. **Academy/coaching/revenue expansion** after evidence loops are reliable.

## Current release gate

The immediate operational blocker is **fresh Deriv ingestion continuity**, not scanner ranking logic. The production endpoint and engine are intact, but the external scheduler stopped invoking them after 2026-09-18. PR #20 adds a redundant five-minute GitHub Actions scheduler while preserving the existing `CRON_SECRET` authorization contract. Its proof run correctly failed closed because GitHub Actions does not yet contain the repository secret. Do not weaken endpoint authentication to bypass this. Once the existing Vercel `CRON_SECRET` is copied securely into GitHub Actions, rerun the protected scheduler proof, verify fresh ticks/evidence/structure snapshots, then complete PR #19 production acceptance testing.
