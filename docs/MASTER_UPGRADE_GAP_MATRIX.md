# Cossa Signals Master Upgrade — Gap Matrix

This matrix maps the current production architecture against the master intelligence/trading specification. It is intentionally evidence-based: a feature is only marked production-ready when the current repository contains the working route/service/schema and the relevant production path is already gated by CI.

## Status legend

- **Production Ready** — implemented and already used in the current production architecture.
- **Exists but Weak** — implemented, but materially below the target specification.
- **Partially Wired** — schema/UI/service exists but the complete workflow is not connected.
- **Missing** — no current implementation was found during repository inspection.
- **Blocked** — should not be enabled until a prerequisite safety/validation layer exists.

## Core platform and safety

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Supabase authentication | Production Ready | Auth middleware, RequireAuth/RequireStaff, role tables and RLS exist. | Continue security review before live broker credentials. |
| Market-data provider abstraction | Production Ready for Deriv | Provider registry, instrument mappings, public Deriv adapter, ingestion audit tables. | Add other providers behind the same interface later. |
| Deriv synthetic registry | Production Ready | Registry sync and current synthetic families are mapped. | Keep provider-symbol configuration editable. |
| Real candle ingestion | Production Ready | `market_candles`, ingestion runs, deterministic pipeline and live ingestion gate exist. | Add broader provider health scoring. |
| Live public tick stream | Production Ready for supported Deriv instruments | Trading terminal now uses authenticated provider-symbol lookup and public Deriv tick subscription. | Add server-side stream workers where continuous backend monitoring is required. |
| Data freshness rejection | Production Ready | Signal pipeline rejects stale candles; execution risk engine rejects stale market data. | Extend to explicit Data Confidence. |
| Demo/Live account separation | Production Ready foundation | `account_environment`, Demo account setup and separate execution-mode logic exist. | Make visual distinction stronger before live execution. |
| Execution audit ledger | Production Ready foundation | Orders, events, fills and positions are persisted. | Extend journal snapshot/audit reasoning. |
| Risk engine | Production Ready foundation | Daily loss, position count, risk sizing, stale data, duplicate and signal-quality gates exist. | Add Data Confidence, correlated exposure, spread/slippage and Guardian layers. |
| Manual emergency stop | Production Ready foundation | Trading account emergency stop is enforced server-side. | Add broader configurable kill switches. |
| Live broker execution | Blocked | Provider-neutral adapter exists, but authenticated live Deriv/broker adapter is not production-eligible. | Do not activate until permissions, Guardian, live eligibility and re-auth are complete. |
| Auto execution | Blocked / Partially Wired | Environment-neutral execution modes exist, but live auto authority is intentionally not enabled. | Build eligibility states, strategy permissions, Guardian and worker runtime first. |

## Trading workspace and charts

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Chart-first terminal | Exists but Weak → improving | Trading route, account selector, order ticket and lifecycle panels exist. | Continue dense professional workspace layout. |
| Candlestick + line charts | Production Ready foundation | OHLC candles and Candle/Line toggle exist. | Add richer chart interaction and zoom/drawing layer. |
| Live movement | Production Ready foundation | Public live Deriv ticks update active candle. | Add latency/stream-health telemetry. |
| Indicator overlays | Exists but Weak | EMA20, EMA50, SMA20, RSI14 and ATR14 are available. | Make indicator selection/configuration editable. |
| Drawing tools / trend lines / channels | Missing | No durable drawing model or chart drawing tools found. | Add chart annotation layer after current chart is stable. |
| Support/resistance / structure / liquidity overlays | Missing | No dedicated detection/persistence engine found. | Build deterministic structure engine before UI claims. |
| Entry/SL/TP overlays | Production Ready foundation | Trading chart supports execution levels. | Add TP2/TP3/trailing/position lifecycle markers. |
| Ask Cossa about this candle | Missing | No candle-context AI endpoint found. | Build context contract first; do not use generic chat responses. |

## Signals and intelligence

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Deterministic signal engine | Production Ready foundation | EMA/RSI/ATR/MACD engine, evidence fingerprinting and tests exist. | Version and expand evidence carefully. |
| Signal Confidence | Exists but Weak | Confidence is deterministic but is not yet outcome-calibrated. | Add calibration datasets before treating it as probability. |
| Data Confidence | Missing | Freshness exists, but no separate persisted explainable Data Confidence score/breakdown. | **Phase 1 priority: implement deterministic data-quality confidence.** |
| Signal evidence snapshot | Production Ready foundation | Fingerprinted evidence stores candle range, indicators, reasons and no-trade reasons. | Extend with data confidence and agent/model snapshots. |
| Smart Matrix | Exists but Weak | Matrix route and SignalMatrix component exist. | Expand into configurable multi-dimensional intelligence matrix. |
| No-trade decisions | Production Ready foundation | Deterministic engine returns WAIT/no-trade reasons. | Persist rejected opportunities for scanner analytics. |
| Agent votes | Partially Wired | `signal_votes` table and signal-detail UI structures exist. | Build real specialist agent runtimes instead of decorative votes. |
| Multi-agent disagreement | Partially Wired | Schema/UI can display votes, but no full supervisor debate engine was found. | Build structured specialist outputs + Supervisor arbitration. |
| Market regime | Production Ready foundation | Regime is computed and persisted. | Expand regime taxonomy and strategy suitability. |
| Opportunity Scanner | Missing | No scanner route/service found. | Build after Data Confidence so ranking does not reward bad feeds. |
| Fundamental/news/calendar intelligence | Missing | No production provider/agent pipeline found. | Add provider abstraction for news/calendar after Deriv-specific separation rules. |
| Sentiment/correlation intelligence | Missing | No production services found. | Add only after source provenance and account exposure model. |

## Accounts, execution and risk

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Demo account bootstrap | Production Ready | Server-controlled virtual account, snapshots and daily baseline exist. | Add clearer account management UI. |
| Demo order execution | Production Ready foundation | Authenticated order endpoint → risk → demo adapter → fill → position. | Expand lifecycle/reconciliation tests. |
| Open position monitoring | Production Ready foundation | Current price, unrealized P/L, TP/SL and manual close are wired. | Move monitoring to durable server workers for unattended automation. |
| Dynamic position sizing | Production Ready foundation | Risk engine sizes from equity/risk/stop distance. | Add exposure, volatility and Data Confidence inputs without increasing risk from confidence alone. |
| Account Guardian | Missing | Current risk engine is not yet the full independent final Guardian. | Build after Data Confidence and exposure model. |
| Correlated exposure | Missing | No portfolio correlation gate found. | Add portfolio/exposure service before live execution. |
| Spread/slippage gate | Missing / partial | Execution schema can record fills, but pre-trade spread/slippage policy is incomplete. | Add provider-aware execution-quality checks. |
| Broker Rules Agent | Missing | No editable broker-rule model found. | Add configuration before external live broker activation. |
| Granular agent permissions | Missing | User roles exist, but trading-agent capability permissions do not. | Required before any autonomous execution. |
| Secure Trading Agent Gateway | Partially Wired | Auth → account → risk → adapter exists, but agent/strategy/Guardian permission stages are absent. | Add stages incrementally; never bypass current risk engine. |
| Live eligibility progression | Missing | No Research→Backtest→Walk-forward→Replay→Demo→Shadow→Limited Live→Proven Live state machine found. | Required before live strategy execution. |

## Research, performance and learning

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Performance UI | Exists but Weak | Performance route/admin performance exist. | Tie results to real execution ledger, strategy/model versions and R metrics. |
| Trade Journal | Missing as full lifecycle journal | Execution events exist but not the complete reasoning/review dataset. | Add journal snapshots after intelligence outputs are versioned. |
| Backtesting | Exists but Weak / legacy concepts | Strategy/performance schema exists but no inspected production-grade cost-aware backtest engine. | Build with no look-ahead and explicit costs. |
| Replay Lab | Missing | No replay route/engine found. | Build after backtest candle access contract. |
| Shadow Trader | Missing | No independent human-vs-Cossa decision ledger found. | Add after journal schema. |
| Counterfactual analysis | Missing | No post-trade counterfactual engine found. | Build only from immutable historical snapshots. |
| Strategy Lab | Partially Wired | Strategies/admin controls exist; natural-language strategy builder/validation pipeline does not. | Build after backtest engine. |
| Academy | Exists but Weak | Academy routes/content exist. | Expand curriculum and connect lessons to actual trading behaviour/charts. |
| Adaptive coach | Missing | No behavioural-to-learning recommendation engine found. | Build after journal/performance signals are trustworthy. |
| Challenge simulator | Missing | No configurable funded-account simulation engine found. | Build on account-risk primitives, not hard-coded prop rules. |

## Product / SaaS / UX

| Capability | Status | Current evidence / gap | Next safe action |
| --- | --- | --- | --- |
| Persistent navigation | Production Ready foundation | AppShell exists. | Reorganise as product areas grow. |
| Command/search bar | Missing | No natural-language command centre found. | Add after routes/services have stable capabilities. |
| Mobile responsive UI | Exists but Weak | Current layout is responsive but trading-specific mobile UX is not complete. | Add mobile chart/trade/risk bottom navigation later. |
| Subscription architecture | Exists but Weak | Subscription/account/admin billing routes exist. | Revisit entitlements after product tiers are defined. |
| Revenue-ready SaaS | Partially Wired | Auth, profiles, subscription primitives exist; advanced tier capability gates are incomplete. | Do not cripple safety/intelligence for monetisation. |

## Phase ordering from this inspection

1. **Data Confidence + provenance** — separate signal quality from feed/data quality and make low-quality data fail closed.
2. **Professional chart context** — continue live chart, structure overlays and immutable chart-analysis snapshots.
3. **Opportunity Scanner** — rank qualified and rejected opportunities using Signal Confidence + Data Confidence + regime + risk suitability.
4. **Account Guardian / exposure intelligence** — correlated exposure, spread/slippage, account-health and independent blocking.
5. **Journal + immutable reasoning snapshots** — prerequisite for calibration, Shadow Trader, coaching and counterfactual analysis.
6. **Multi-agent reasoning architecture** — specialist outputs, disagreement and Supervisor decision contract.
7. **Backtest / walk-forward / Replay** — then formal live-eligibility state machine.
8. **Secure agent permissions + broker rules + durable workers** — before limited live automation.
9. **Academy/coaching/revenue expansion** after evidence loops are reliable.

## Immediate implementation decision

The first additive implementation is **Data Confidence**. Current code already has stale-data rejection but combines signal confidence with data quality too loosely. The new layer must be deterministic and explainable. It will score only observable data-quality properties (sample coverage, freshness and candle continuity), persist the breakdown with evidence, and later feed a configurable execution threshold. It is an operational data-quality score, **not** a probability that a trade will win.
