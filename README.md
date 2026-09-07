# Cossa Signals Hub

COSSA SIGNALS 

Build Cossa Signals, a professional trading intelligence and signals platform owned by Cossa Nexus Holdings (Pty) Ltd, operated under the Cossa Tech division.

This is not a simple signal board and it is not an auto-trading bot.

It must be designed as a scalable financial market intelligence platform that can later connect to the existing Cossa Signals Python engine, AI agents, machine-learning models, live market feeds, backtesting systems, paper-trading systems, alerting services, and Cossa AI OS.

Build the frontend, database architecture, user platform, administration tools, signal intelligence interface, analytics layer, subscription system, education hub, and integration points now.

Do not rebuild or replace the existing Python Cossa Signals backend.

The existing Python engine remains the source of truth for strategy calculations, backtesting, paper trading, and future ML signal generation.

---

1. PRODUCT VISION

Build:

COSSA SIGNALS

A premium market intelligence platform covering:

- Forex

- Deriv Synthetic Indices

- Volatility Indices

- Boom Indices

- Crash Indices

- Bull/Bear Indices

- Daily Reset Indices

- Step Index

- Other validated synthetic indices added later

- Traditional market indices in future

- Shares/equities in future

- Commodities in future

The platform must combine:

Signals + Market Intelligence + Indicators + Risk + Historical Evidence + AI Explanation + Performance Tracking

The long-term goal is to build one of Africa's strongest evidence-driven market intelligence platforms.

Do not market it using unsupported claims.

The product should earn its reputation through transparent results.

---

2. CORE PRODUCT PRINCIPLE

Cossa Signals must never simply say:

BUY

or:

SELL

without context.

Every signal should eventually be capable of explaining:

- Instrument

- Direction

- Entry

- Stop-loss

- Take-profit

- Risk/reward

- Confidence

- Market regime

- Strategy

- Supporting indicators

- Contradicting indicators

- Historical sample size

- Backtest status

- Paper-trading status

- Live-validation status

- Signal age

- Signal expiry

- Risk rating

- Why the setup exists

- Why the setup could fail

Also support:

WAIT

and:

NO TRADE

as valid outputs.

Cossa Signals must prefer rejecting weak trades over generating unnecessary signals.

---

3. PRODUCT POSITIONING

Position Cossa Signals as:

Transparent. Evidence-based. Risk-aware. Intelligent.

Do not create the visual language of gambling, binary options, casinos, guaranteed profits, or "get rich quickly" products.

The experience should feel closer to:

Bloomberg Terminal + TradingView + institutional analytics + modern AI SaaS.

---

4. BRAND SYSTEM

Strict Cossa Nexus Holdings design language.

Colors

Background:

"#000000"

Primary gold:

"#D4AF37"

Primary body text:

"#FFFFFF"

Secondary background/card:

"#1A1A1A"

Muted panel:

"#111111"

Borders:

subtle dark grey / muted gold

Do not introduce blue as a primary brand color.

Signal colors may use functional market colors:

- Green = bullish/buy

- Red = bearish/sell

- Amber = caution

- Grey = neutral/wait

But gold remains the primary Cossa brand accent.

Typography

Use:

Inter

or another clean modern sans-serif.

Style

Premium fintech.

Dense but readable.

Professional.

Minimal unnecessary animation.

Fast loading.

Mobile-first.

Responsive on:

- Android

- iPhone

- Tablet

- Laptop

- Desktop

Dark mode only.

---

5. TECH STACK

Use Lovable's standard production-quality stack.

Preferred:

- React

- TypeScript

- Vite

- Tailwind

- Supabase

Supabase provides:

- Authentication

- PostgreSQL

- Row Level Security

- Realtime

- Edge Functions where appropriate

- Storage if needed

Architect the frontend so the Python Cossa Signals backend can write data directly into Supabase.

Never expose service-role keys or private backend credentials in the frontend.

---

6. SYSTEM ARCHITECTURE

Design the platform around this future architecture:

Deriv / Forex / Market Data

↓

Cossa Data Pipeline

↓

Feature & Indicator Engine

↓

Instrument Intelligence

↓

Strategy Engine

↓

Machine Learning Models

↓

AI Signal Council

↓

Risk Gate

↓

Signal Database

↓

Supabase Realtime

↓

Cossa Signals Dashboard

↓

User Alerts / WhatsApp / Telegram / Push Notifications

Lovable is responsible primarily for:

Supabase + frontend + UI + admin + user experience + data contracts

Do not attempt to recreate the Python trading engine inside the browser.

---

7. DATABASE ARCHITECTURE

Build a scalable database structure.

All important operational tables must include:

- "id"

- "created_at"

- "updated_at"

Use appropriate indexes.

Use foreign keys.

Enable Row Level Security.

---

TABLE: instruments

Fields:

- id

- symbol

- display_name

- asset_class

Values could include:

- forex

- synthetic_index

- index

- equity

- commodity

- category

Examples:

- volatility

- volatility_1s

- boom

- crash

- bull_bear

- daily_reset

- step

- forex_major

- forex_minor

- forex_exotic

- provider

Examples:

- deriv

- forex

- future providers

- timeframe_default

- market_status

- enabled

- validation_status

Validation enum:

- experimental

- backtested

- validation_pending

- paper_trading

- paper_validated

- live_verified

- paused

- rejected

- minimum_sample_required

- description

- risk_rating

- data_source

- last_data_at

---

8. SIGNAL TABLE

TABLE: signals

Fields:

- id

- instrument_id

- strategy_id

- strategy_name

- model_id nullable

- timeframe

- direction

Direction enum:

- buy

- sell

- neutral

- wait

- no_trade

- confidence_score

- confidence_grade

Examples:

- low

- moderate

- strong

- high

- entry_price

- entry_zone_low

- entry_zone_high

- stop_loss

- take_profit_1

- take_profit_2

- take_profit_3

- risk_reward_ratio

- status

Status enum:

- pending

- active

- target_1_hit

- target_2_hit

- target_3_hit

- closed_win

- closed_loss

- break_even

- expired

- cancelled

- invalidated

- mode

Mode enum:

- research

- backtest

- paper

- live_verified

- validation_status

- risk_rating

- market_regime

- opened_at

- expires_at

- closed_at

- current_price

- unrealized_return_pct

- realized_return_pct

- invalidation_reason

- signal_reason

- failure_risk

- source_version

- data_timestamp

Signals must NEVER be fabricated client-side.

---

9. STRATEGY REGISTRY

Create:

TABLE: strategies

Fields:

- id

- name

- description

- strategy_family

Examples:

- mean_reversion

- momentum

- breakout

- trend_following

- spike_reversion

- daily_reset

- volatility

- machine_learning

- ensemble

- applicable_instruments

- applicable_timeframes

- validation_status

- minimum_trades

- version

- enabled

- created_at

This allows Cossa Signals to track exactly which strategy generated each signal.

---

10. INDICATOR INTELLIGENCE

Create:

TABLE: signal_indicators

Each signal may contain multiple indicators.

Fields:

- id

- signal_id

- indicator_name

- indicator_value

- interpretation

- direction

Direction values:

- bullish

- bearish

- neutral

- weight

- timeframe

Support indicators such as:

- RSI

- MACD

- Moving averages

- EMA

- SMA

- Bollinger Bands

- ATR

- ADX

- Stochastic RSI

- Momentum

- ROC

- Support/resistance

- Volatility

- Candle structure

- Market structure

- Breakout state

- Trend state

The UI must clearly show that indicators SUPPORT a signal.

Indicators do not independently prove profitability.

---

11. MARKET REGIME ENGINE

Create data support for:

TABLE: market_regimes

Fields:

- id

- instrument_id

- timeframe

- regime

Possible values:

- trending_up

- trending_down

- ranging

- high_volatility

- low_volatility

- spike_risk

- reset_window

- breakout

- unstable

- unknown

- confidence_score

- detected_at

- expires_at

The dashboard should show the current market regime beside each instrument.

---

12. SMART SIGNAL MATRIX

This is the centerpiece of the application.

Create a real-time:

SMART SIGNAL MATRIX

Users should see rows/cards representing instruments.

Columns:

Instrument

Category

Current Price

Signal

Confidence

Market Regime

Timeframe

Entry

Stop Loss

Take Profit

Risk/Reward

Risk Rating

Validation Level

Strategy

Signal Age

Data Freshness

Status

Example:

R_75

Volatility 75

WAIT

Confidence: 42%

5m

Range Market

RSI Mean Reversion

Experimental

Updated 12 seconds ago

Do not force every instrument to have a trade.

Neutral/Wait should be common.

---

13. MATRIX FILTERS

Allow filtering by:

- Forex

- Synthetic Indices

- Volatility

- Boom

- Crash

- Bull/Bear

- Step

- Buy

- Sell

- Wait

- High confidence

- Paper validated

- Live verified

- Timeframe

- Strategy

- Risk rating

- Market regime

Allow:

sorting by confidence

sorting by newest

sorting by risk/reward

sorting by validation level

---

14. SIGNAL DETAIL PAGE

Every signal gets its own detailed page.

Display:

Instrument

Current market price

Direction

Signal status

Entry

Stop

Targets

Risk/reward

Confidence

Timeframe

Signal age

Expiry

Market regime

Strategy

Validation status

Historical performance

Indicators

Reasons supporting signal

Reasons against signal

Risk factors

Signal timeline

Outcome when closed

---

15. AI SIGNAL EXPLANATION AREA

Prepare the UI for a future Cossa Signals AI Analyst.

Create an:

AI Analysis

section.

This is NOT generated by Lovable.

The backend will eventually populate it.

Fields may include:

- AI summary

- bullish evidence

- bearish evidence

- uncertainty

- risk explanation

- market context

- recommendation type

Recommendation type:

- strong_setup

- moderate_setup

- weak_setup

- wait

- avoid

The frontend only displays these fields.

---

16. AI SIGNAL COUNCIL

Design support for future multi-agent analysis.

Create:

TABLE: signal_votes

Fields:

- id

- signal_id

- agent_name

- vote

Vote:

- buy

- sell

- neutral

- reject

- confidence

- reason

- created_at

Future agents may include:

- Market Regime Agent

- Technical Analysis Agent

- Forex Agent

- Synthetic Index Agent

- Boom/Crash Specialist

- Risk Officer

- ML Probability Agent

- Backtest Validator

- Signal Director

Display agent consensus inside signal detail pages.

Example:

5 agents support

2 neutral

1 reject

Final decision:

WAIT

---

17. RISK GATE

Create support for:

TABLE: risk_checks

Fields:

- signal_id

- overall_status

Values:

- approved

- caution

- rejected

Checks:

- excessive volatility

- poor risk/reward

- stale market data

- insufficient historical evidence

- strategy under validation

- conflicting indicators

- excessive correlation

- abnormal market behaviour

- system health problem

The Risk Gate must be visible in the UI.

Even high confidence does not bypass the Risk Gate.

---

18. PERFORMANCE ENGINE UI

Create:

Performance & Track Record

Filters:

- instrument

- strategy

- timeframe

- market

- validation mode

- period

Metrics:

- signals

- wins

- losses

- break-even

- win rate

- average win

- average loss

- profit factor

- average R:R

- max drawdown

- Sharpe ratio

- total return

- average signal duration

Never show misleading percentages.

If:

"total_trades < 30"

show:

Insufficient sample size — not statistically reliable yet.

Do not rank it as a proven strategy.

---

19. PERFORMANCE SNAPSHOTS

Create:

TABLE: performance_snapshots

Fields:

- id

- instrument_id

- strategy_id

- timeframe

- mode

- total_trades

- wins

- losses

- win_rate

- average_win

- average_loss

- profit_factor

- avg_rr_ratio

- max_drawdown

- sharpe_ratio

- total_return_pct

- benchmark_return_pct

- beats_benchmark

- sample_reliable

- calculated_at

This data comes from the backend only.

---

20. SIGNAL HISTORY

Build searchable historical signal records.

Allow users to see:

- previous signals

- outcome

- opening price

- closing price

- targets hit

- stop hit

- entry date

- closure date

- performance

Do not delete losing signals.

Transparency requires wins and losses.

---

21. WATCHLIST

Users should be able to create personal watchlists.

Example:

My Watchlist

- R_75

- R_100

- BOOM500

- XAUUSD

- EURUSD

Store in:

TABLE: watchlists

and:

TABLE: watchlist_items

---

22. ALERT PREFERENCES

Prepare future notification support.

Users should eventually choose alerts for:

- new signal

- high-confidence signal

- signal invalidated

- target hit

- stop-loss hit

- instrument becomes active

- major regime change

Channels:

- in-app

- email

- Telegram

- WhatsApp

- push notification

Do not build WhatsApp/Telegram infrastructure yet unless easy.

Build the preference/database layer.

---

23. DATA FRESHNESS

This is critical.

Every screen using market data must show freshness.

Examples:

LIVE

12 sec ago

2 min ago

STALE DATA

If market data is older than a configurable threshold:

do not display it as live.

Create:

TABLE: data_health

Fields:

- provider

- instrument_id

- last_received_at

- latency_ms

- status

Status:

- healthy

- delayed

- stale

- offline

---

24. SYSTEM HEALTH

Create an admin system-health page.

Monitor:

- Python signal engine

- market data feed

- Supabase

- realtime connection

- signal writer

- notification worker

- AI service

- latest heartbeat

Create:

TABLE: service_heartbeats

Fields:

- service_name

- status

- last_heartbeat

- message

- metadata

---

25. AUDIT LOG

Create:

TABLE: audit_logs

Track:

- admin actions

- signal status changes

- strategy validation changes

- kill switch actions

- subscription modifications

- system changes

Fields:

- actor

- action

- entity

- entity_id

- old_value

- new_value

- timestamp

Never silently change validation statuses.

---

26. ADMIN PANEL

Role-protected.

Roles:

- super_admin

- admin

- analyst

- support

- user

Abel / CEO account must have:

"super_admin"

Admin capabilities:

- manage instruments

- manage strategies

- enable/disable instruments

- enable/disable strategy display

- update validation statuses

- view raw signal feed

- view system health

- view stale services

- inspect performance

- manage education content

- manage subscriptions

- manage users

- activate kill switch

---

27. GLOBAL KILL SWITCH

Create:

TABLE: platform_controls

Fields:

- signals_enabled

- alerts_enabled

- maintenance_mode

- emergency_message

- updated_by

- updated_at

If:

"signals_enabled = false"

the application must stop presenting active signals and display:

Signal delivery temporarily paused by Cossa Signals risk controls.

Historical records remain visible.

---

28. USER AUTHENTICATION

Use Supabase Auth.

Support:

- Email/password

- Password reset

- Email verification

Prepare architecture for future:

- Google login

- Apple login

---

29. USER PROFILE

Create:

TABLE: profiles

Fields:

- id

- email

- full_name

- phone

- country

- preferred_currency

- subscription_tier

- subscription_status

- risk_disclosure_accepted

- terms_accepted_at

- created_at

- last_login_at

---

30. SUBSCRIPTION SYSTEM

Tiers:

Free

- limited instruments

- delayed signals

- limited signal history

- education hub

- limited performance data

Basic

- more instruments

- faster signals

- full history

- watchlists

- alerts

Pro

- real-time matrix

- all available instruments

- advanced AI analysis

- full strategy analytics

- priority alerts

- detailed market intelligence

- advanced filters

Make the tier configuration database-driven.

Do not hardcode access rules throughout components.

---

31. BILLING

Preferred:

PayFast

because Cossa Nexus Holdings operates in South Africa.

Prepare architecture for:

- PayFast

- future Yoco

- Stripe only where legally/commercially supported

Create:

TABLE: subscriptions

Fields:

- id

- user_id

- tier

- provider

- provider_customer_id

- provider_subscription_id

- status

- current_period_start

- current_period_end

- cancelled_at

Billing status must be updated through secure server-side webhook processing.

Do not trust client-side payment success.

---

32. EDUCATION HUB

Create:

Cossa Signals Academy

Categories:

- Forex Basics

- Synthetic Indices

- Volatility Indices

- Boom & Crash

- Bull/Bear

- Step Index

- Indicators

- Risk Management

- Backtesting

- Market Psychology

- AI & Trading

- Understanding Signals

Use the existing Cossa Deriv educational guide as a future source.

Content can initially have empty/content-management states.

Do not fabricate educational claims where source content has not yet been provided.

---

33. INSTRUMENT LIBRARY

Create a detailed page for every instrument.

Display:

- instrument name

- symbol

- category

- description

- risk level

- market characteristics

- common strategies tested

- validation status

- current regime

- performance history

- active signal

- educational resources

---

34. FOREX INTELLIGENCE

Build the architecture now for Forex.

Support:

- EURUSD

- GBPUSD

- USDJPY

- USDZAR

- GBPJPY

- XAUUSD if later treated under commodities/metals

Future information may include:

- trend

- volatility

- session

- spread

- economic-event risk

- technical indicators

- AI analysis

Do not fabricate real-time forex prices without a connected provider.

---

35. INDICES INTELLIGENCE

Prepare support for traditional indices later.

Examples:

- NASDAQ

- S&P 500

- DAX

- FTSE

- JSE indices

Do not add fake live values.

---

36. SMART SEARCH

Create global search.

Users should search:

- R_75

- Volatility 75

- RSI

- Boom 500

- EURUSD

- strategy names

- education content

---

37. SMART COMMAND CENTER

Create a premium main dashboard.

Sections:

Market Overview

- active signals

- wait signals

- high-risk conditions

- live instruments

- data health

Smart Signal Matrix

Main matrix.

Top Validated Setups

Only include setups satisfying configured validation rules.

Watchlist

User's selected instruments.

Market Regimes

Current market environments.

Latest Intelligence

Recent AI explanations.

Performance Snapshot

Recent verified performance.

---

38. SMART CONFIDENCE

Confidence must not be displayed as fake certainty.

Create visual decomposition for future backend data:

Example:

Confidence: 78%

Technical indicators: 82

Market regime: 75

Historical strategy strength: 71

ML probability: 79

Risk adjustment: -8

Final: 78

Frontend must only render values supplied by backend.

---

39. SIGNAL QUALITY SCORE

Prepare:

"signal_quality_score"

0–100.

Future scoring may incorporate:

- model confidence

- strategy history

- market regime

- data quality

- risk/reward

- indicator agreement

- sample reliability

UI classifications:

90–100: Exceptional setup

80–89: Strong

70–79: Qualified

60–69: Watch

Below 60: No trade

Do not implement fake score calculations client-side.

---

40. DATA PROVENANCE

Every important piece of intelligence should support:

- source

- calculated_at

- model_version

- strategy_version

- data_timestamp

The platform must make it possible to audit:

Where did this signal come from?

---

41. MODEL REGISTRY

Prepare:

TABLE: models

Fields:

- id

- name

- model_type

- version

- validation_status

- training_period

- test_period

- features_used

- performance_summary

- enabled

- created_at

Future types:

- classification

- regression

- ensemble

- anomaly detection

- regime detection

---

42. NO-TRADE INTELLIGENCE

Build explicit UI support for NO TRADE.

Example:

R_75

NO TRADE

Reason:

- conflicting indicators

- poor R:R

- unstable volatility

- strategy confidence below threshold

This is important.

The platform should not create trades merely to keep users engaged.

---

43. MOBILE EXPERIENCE

Most Cossa users may access the platform on mobile.

Mobile must be first-class.

The Smart Matrix should transform into cards cleanly.

Critical information must remain visible:

- instrument

- direction

- confidence

- entry

- SL

- TP

- validation

- risk

Do not create desktop-only financial tables that become unreadable on phones.

---

44. PERFORMANCE

Optimize:

- lazy loading

- code splitting

- efficient Supabase subscriptions

- query indexes

- minimal unnecessary realtime channels

- cached static education content

Avoid excessive animations.

Dashboard should feel immediate.

---

45. SECURITY

Non-negotiable.

Never expose:

- Supabase service role key

- Deriv API token

- Python backend secrets

- payment secrets

- webhook secrets

Frontend only uses public-safe keys.

All privileged actions go through protected backend functions.

Use:

- RLS

- role checks

- server-side authorization

- webhook signature verification

---

46. COMPLIANCE

Cossa Signals must clearly state:

Cossa Signals provides market information and trading signals for educational and informational purposes. It does not guarantee outcomes. Trading involves substantial risk of financial loss.

Do not claim:

- guaranteed returns

- guaranteed accuracy

- risk-free trading

- guaranteed profit

Before viewing live/paper signals, users must accept:

- Terms of Service

- Risk Disclosure

- Privacy Policy

Build acceptance tracking into the database.

---

47. SIGNAL VALIDATION BADGES

Use clear statuses:

Experimental

Backtested

Validation Pending

Paper Trading

Paper Validated

Live Verified

Paused

Rejected

Users must always know the maturity of the underlying strategy.

---

48. IMPORTANT STATISTICAL RULE

A result with fewer than:

"30 trades"

must not be treated as statistically reliable.

Display:

Insufficient sample size

rather than presenting a misleading headline win rate.

---

49. EMPTY STATES

Never generate fake market activity.

Examples:

No active signals:

No qualified signals right now. Cossa Signals is monitoring the market.

Engine unavailable:

Market intelligence temporarily unavailable.

Data stale:

Live market data delayed — signals paused for safety.

No performance history:

Validation data not yet available.

---

50. DEMO / SEED DATA RULE

Lovable may create clearly labelled seed data during development.

Every seeded signal must include:

"is_demo = true"

Demo data must never appear as live production performance.

Provide an easy way to delete demo data before production.

---

51. INTEGRATION CONTRACT WITH COSSA SIGNALS PYTHON

Existing repository:

"cossanexusholdingsCNH/cossa-signals"

The Python system controls:

- data fetching

- backtesting

- strategy calculations

- market-regime calculations

- indicators

- paper trading

- future machine learning

- future AI Signal Council

- performance calculations

- signal generation

Lovable controls:

- user application

- database interface

- Supabase Realtime

- dashboards

- subscriptions

- administration

- visualizations

- alerts interface

- education

- settings

Do not mix these responsibilities.

---

52. FUTURE COSSA AI OS INTEGRATION

Prepare the application so Cossa AI OS can later monitor:

- platform health

- new signals

- performance

- failed market feeds

- user activity

- subscriptions

- revenue

- anomalies

- risk alerts

Do not build Cossa AI OS itself inside this project.

Just maintain clean APIs/database structures for future integration.

---

53. EXPLICIT DO-NOT LIST

DO NOT:

- Auto-place real trades

- Build copy trading yet

- Fabricate signals

- Fabricate market data

- Fabricate win rates

- Fabricate AI analysis

- Generate fake live users

- Show demo data as production

- Expose credentials

- Treat backtesting as proof

- Treat one winning trade as 100% reliable

- Call experimental strategies verified

- Promise profits

- Build casino-like visual design

- Recreate the Python engine in React

- Hardcode subscription permissions throughout the UI

- Allow frontend code to modify validated performance metrics

---

54. ROUTES

Build approximately:

"/"

Public landing page

"/dashboard"

Smart Command Center

"/signals"

All signals

"/signals/:id"

Signal detail

"/matrix"

Smart Signal Matrix

"/performance"

Track record

"/markets"

Market intelligence

"/markets/forex"

Forex

"/markets/synthetics"

Synthetic indices

"/instruments/:symbol"

Instrument intelligence

"/watchlist"

User watchlist

"/academy"

Education hub

"/academy/:slug"

Article/course page

"/pricing"

Subscriptions

"/account"

Profile

"/account/subscription"

Billing

"/account/alerts"

Alert preferences

"/admin"

Admin overview

"/admin/signals"

Signal feed

"/admin/instruments"

Instrument management

"/admin/strategies"

Strategy management

"/admin/performance"

Validation analytics

"/admin/system"

System health

"/admin/users"

Users

"/admin/billing"

Billing

"/admin/audit"

Audit log

---

55. LANDING PAGE

Professional public homepage.

Hero:

COSSA SIGNALS

Market Intelligence. Evidence-Based Signals. Smarter Decisions.

Supporting copy:

Analyze forex and synthetic markets using transparent strategy validation, risk controls, market intelligence and real performance data.

CTAs:

View Signals

Explore Markets

Create Account

Do not use guaranteed-profit language.

---

56. DEVELOPMENT PHASES

Lovable must build this in stages.

Do not try to implement everything simultaneously.

PHASE 1 — FOUNDATION

Build:

- Supabase project integration

- database schema

- enums

- RLS

- authentication

- user profiles

- roles

- audit framework

Verify before continuing.

---

PHASE 2 — DESIGN SYSTEM

Build:

- CNH visual system

- responsive shell

- navigation

- mobile layout

- desktop layout

- reusable cards

- badges

- tables

- charts

- empty states

---

PHASE 3 — SMART MATRIX

Build:

- Signal Matrix

- Supabase Realtime

- matrix filters

- instrument filters

- confidence

- risk

- validation

- market regime

- data freshness

Use DEMO-LABELLED seed data only for testing.

---

PHASE 4 — SIGNAL INTELLIGENCE

Build:

- signal detail page

- indicators

- AI explanation placeholder

- Signal Council UI

- Risk Gate

- lifecycle timeline

- signal outcomes

---

PHASE 5 — PERFORMANCE

Build:

- track record

- strategy analytics

- instrument analytics

- benchmark comparison

- statistical sample guardrail

- historical signal explorer

---

PHASE 6 — MARKET INTELLIGENCE

Build:

- Forex area

- Synthetic Index area

- instrument profiles

- market regimes

- watchlists

- smart search

---

PHASE 7 — USERS & SUBSCRIPTIONS

Build:

- Free

- Basic

- Pro

- entitlement system

- pricing

- subscription management

- payment integration architecture

Prefer PayFast.

Do not block completion if payment credentials are not yet supplied.

Create clean integration placeholders instead.

---

PHASE 8 — EDUCATION

Build:

- Cossa Signals Academy

- categories

- article templates

- instrument guides

- search

---

PHASE 9 — ADMIN

Build:

- super admin

- instrument control

- strategy controls

- system health

- kill switch

- user management

- performance verification

- billing overview

- audit logs

---

PHASE 10 — PRODUCTION QA

Verify:

- Mobile

- Desktop

- Authentication

- RLS

- Permissions

- Realtime

- Empty states

- Demo-data labelling

- Statistical guardrails

- Data freshness

- Kill switch

- Security

- Navigation

- Accessibility

- Performance

---

57. LOVABLE WORKING RULE

Before modifying existing work:

inspect first.

Do not repeatedly rebuild completed components.

Extend the architecture.

Reuse working components.

Do not destroy completed work to add another feature.

At the end of each phase report:

1. What was built

2. Files created

3. Files changed

4. Database changes

5. Routes completed

6. Security/RLS implemented

7. What remains

8. Any blocker requiring Abel/Cossa approval

Then continue to the next phase only when the current phase is stable.

---

FINAL OBJECTIVE

Cossa Signals should eventually become more than a signal provider.

It should become a:

MARKET INTELLIGENCE OPERATING SYSTEM

capable of combining:

Forex Intelligence

Synthetic Index Intelligence

Technical Indicators

Market Regimes

Backtesting

Machine Learning

AI Agents

Risk Management

Live Signals

Paper Trading

Performance Verification

Education

User Alerts

and Cossa AI OS integration.

Build the platform architecture now so we do not need to rebuild it later when these capabilities are connected.

Build professional infrastructure first.

Intelligence will be wired into it afterward.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/80bdbbce-2aa4-4340-92a9-acf373aee345).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
