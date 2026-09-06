-- Instruments
INSERT INTO public.instruments (symbol, display_name, asset_class, category, provider, timeframe_default, market_status, validation_status, risk_rating, description, market_characteristics, data_source, is_demo) VALUES
('R_10','Volatility 10 Index','synthetic_index','volatility','deriv','5m','open','backtested','moderate','Synthetic index with constant 10% volatility.','Low volatility, smoother trends, tighter ranges.','deriv_ws',true),
('R_25','Volatility 25 Index','synthetic_index','volatility','deriv','5m','open','backtested','moderate','Synthetic index with constant 25% volatility.','Moderate volatility with frequent mean reversion.','deriv_ws',true),
('R_50','Volatility 50 Index','synthetic_index','volatility','deriv','5m','open','validation_pending','high','Synthetic index with constant 50% volatility.','Balanced trend and range behaviour.','deriv_ws',true),
('R_75','Volatility 75 Index','synthetic_index','volatility','deriv','5m','open','paper_trading','high','Synthetic index with constant 75% volatility.','High volatility, strong impulsive legs.','deriv_ws',true),
('R_100','Volatility 100 Index','synthetic_index','volatility','deriv','5m','open','paper_validated','high','Synthetic index with constant 100% volatility.','Very high volatility, wide stops required.','deriv_ws',true),
('1HZ75V','Volatility 75 (1s) Index','synthetic_index','volatility_1s','deriv','1m','open','experimental','extreme','One-second tick synthetic volatility index.','Extremely fast ticks; execution sensitive.','deriv_ws',true),
('BOOM500','Boom 500 Index','synthetic_index','boom','deriv','5m','open','experimental','extreme','Upward spikes on average every 500 ticks.','Slow drips down, sudden upward spikes.','deriv_ws',true),
('BOOM1000','Boom 1000 Index','synthetic_index','boom','deriv','5m','open','experimental','extreme','Upward spikes on average every 1000 ticks.','Longer drip phases, larger spikes.','deriv_ws',true),
('CRASH500','Crash 500 Index','synthetic_index','crash','deriv','5m','open','experimental','extreme','Downward spikes on average every 500 ticks.','Slow drips up, sudden downward spikes.','deriv_ws',true),
('CRASH1000','Crash 1000 Index','synthetic_index','crash','deriv','5m','open','experimental','extreme','Downward spikes on average every 1000 ticks.','Longer drip phases, larger spikes.','deriv_ws',true),
('BULL','Bull Market Index','synthetic_index','bull_bear','deriv','5m','open','experimental','high','Upward-biased synthetic market.','Persistent upward bias with pullbacks.','deriv_ws',true),
('BEAR','Bear Market Index','synthetic_index','bull_bear','deriv','5m','open','experimental','high','Downward-biased synthetic market.','Persistent downward bias with rallies.','deriv_ws',true),
('STEPIDX','Step Index','synthetic_index','step','deriv','5m','open','backtested','moderate','Fixed step size of 0.1 with equal up/down probability.','Uniform step behaviour, clean structure.','deriv_ws',true),
('RDBULL','Bull Daily Reset Index','synthetic_index','daily_reset','deriv','15m','open','experimental','high','Daily reset index with bullish bias.','Behaviour changes around the daily reset window.','deriv_ws',true),
('EURUSD','Euro / US Dollar','forex','forex_major','forex','15m','open','validation_pending','moderate','The most traded currency pair globally.','Session-driven; sensitive to ECB and Fed events.','forex_feed',true),
('GBPUSD','British Pound / US Dollar','forex','forex_major','forex','15m','open','experimental','high','Cable — high London-session activity.','Wider ranges, news sensitive.','forex_feed',true),
('USDJPY','US Dollar / Japanese Yen','forex','forex_major','forex','15m','open','experimental','moderate','Major yen pair.','Trend persistence; rate-differential driven.','forex_feed',true),
('USDZAR','US Dollar / South African Rand','forex','forex_exotic','forex','1h','open','experimental','extreme','Emerging-market pair with wide spreads.','High volatility, local event risk.','forex_feed',true),
('GBPJPY','British Pound / Japanese Yen','forex','forex_minor','forex','15m','open','experimental','extreme','Highly volatile cross.','Large ranges; requires wide stops.','forex_feed',true),
('XAUUSD','Gold / US Dollar','commodity','metals','forex','1h','open','experimental','high','Spot gold against the US dollar.','Macro and rate driven; strong trends.','forex_feed',true);

-- Strategies
INSERT INTO public.strategies (name, description, strategy_family, applicable_instruments, applicable_timeframes, validation_status, minimum_trades, version, is_demo) VALUES
('RSI Mean Reversion','Fades statistically stretched RSI readings inside confirmed ranges.','mean_reversion',ARRAY['R_10','R_25','R_50','R_75'],ARRAY['1m','5m','15m'],'paper_trading',30,'0.4.2',true),
('EMA Trend Continuation','Enters pullbacks in the direction of an established EMA trend stack.','trend_following',ARRAY['R_75','R_100','EURUSD','XAUUSD'],ARRAY['5m','15m','1h'],'backtested',30,'0.3.0',true),
('ATR Breakout','Trades range expansion confirmed by ATR and ADX.','breakout',ARRAY['R_100','GBPJPY','STEPIDX'],ARRAY['15m','1h'],'validation_pending',30,'0.2.1',true),
('Spike Reversion','Post-spike reversion logic for Boom and Crash markets.','spike_reversion',ARRAY['BOOM500','BOOM1000','CRASH500','CRASH1000'],ARRAY['1m','5m'],'experimental',50,'0.1.4',true),
('Daily Reset Window','Exploits behavioural shifts around daily reset boundaries.','daily_reset',ARRAY['RDBULL'],ARRAY['15m','1h'],'experimental',40,'0.1.0',true),
('Regime Ensemble','Combines regime detection with strategy voting before release.','ensemble',ARRAY['R_75','R_100','EURUSD'],ARRAY['5m','15m'],'experimental',60,'0.1.2',true);

-- Market regimes
INSERT INTO public.market_regimes (instrument_id, timeframe, regime, confidence_score, detected_at, expires_at, is_demo)
SELECT i.id, i.timeframe_default,
  (CASE i.category
     WHEN 'volatility' THEN 'ranging'
     WHEN 'boom' THEN 'spike_risk'
     WHEN 'crash' THEN 'spike_risk'
     WHEN 'bull_bear' THEN 'trending_up'
     WHEN 'step' THEN 'low_volatility'
     WHEN 'daily_reset' THEN 'reset_window'
     WHEN 'forex_major' THEN 'trending_up'
     WHEN 'forex_minor' THEN 'high_volatility'
     WHEN 'forex_exotic' THEN 'unstable'
     ELSE 'unknown' END)::public.regime_type,
  62, now() - interval '3 minutes', now() + interval '30 minutes', true
FROM public.instruments i;

-- Data health
INSERT INTO public.data_health (provider, instrument_id, last_received_at, latency_ms, status)
SELECT i.provider, i.id, now() - interval '11 seconds', 84, 'healthy' FROM public.instruments i;

UPDATE public.instruments SET last_data_at = now() - interval '11 seconds',
  current_price = CASE symbol
    WHEN 'R_10' THEN 6412.83 WHEN 'R_25' THEN 2841.06 WHEN 'R_50' THEN 189.4412
    WHEN 'R_75' THEN 104238.52 WHEN 'R_100' THEN 1642.77 WHEN '1HZ75V' THEN 9284.31
    WHEN 'BOOM500' THEN 12604.11 WHEN 'BOOM1000' THEN 8402.55 WHEN 'CRASH500' THEN 6120.09
    WHEN 'CRASH1000' THEN 4884.62 WHEN 'BULL' THEN 1204.18 WHEN 'BEAR' THEN 884.02
    WHEN 'STEPIDX' THEN 9284.6 WHEN 'RDBULL' THEN 1042.33 WHEN 'EURUSD' THEN 1.0842
    WHEN 'GBPUSD' THEN 1.2714 WHEN 'USDJPY' THEN 151.42 WHEN 'USDZAR' THEN 18.4123
    WHEN 'GBPJPY' THEN 192.55 WHEN 'XAUUSD' THEN 2384.62 END;

-- Signals
WITH s AS (
  INSERT INTO public.signals (instrument_id, strategy_id, strategy_name, timeframe, direction, confidence_score, confidence_grade,
    confidence_breakdown, signal_quality_score, entry_price, entry_zone_low, entry_zone_high, stop_loss, take_profit_1, take_profit_2,
    risk_reward_ratio, status, mode, validation_status, risk_rating, market_regime, opened_at, expires_at, current_price,
    unrealized_return_pct, signal_reason, failure_risk, no_trade_reasons, historical_sample_size, source_version, strategy_version,
    data_timestamp, calculated_at, ai_summary, ai_bullish_evidence, ai_bearish_evidence, ai_uncertainty, ai_risk_explanation,
    ai_market_context, ai_recommendation, is_demo)
  SELECT i.id, st.id, st.name, v.timeframe, v.direction::public.signal_direction, v.conf, v.grade::public.confidence_grade,
    v.breakdown::jsonb, v.quality, v.entry, v.zlow, v.zhigh, v.sl, v.tp1, v.tp2, v.rr, v.status::public.signal_status,
    v.mode::public.signal_mode, v.vstat::public.validation_status, v.risk::public.risk_rating, v.regime::public.regime_type,
    now() - (v.age_min || ' minutes')::interval,
    now() + (v.exp_min || ' minutes')::interval, i.current_price, v.upl, v.reason, v.frisk, v.notrade, v.sample,
    '0.9.3-demo','0.4.2', now() - interval '14 seconds', now() - interval '10 seconds',
    v.ai_sum, v.ai_bull, v.ai_bear, v.ai_unc, v.ai_risk, v.ai_ctx, v.ai_rec::public.recommendation_type, true
  FROM (VALUES
    ('R_75','RSI Mean Reversion','5m','wait',42,'low','{"technical_indicators":48,"market_regime":45,"historical_strategy_strength":40,"ml_probability":null,"risk_adjustment":-6,"final":42}',54,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'pending','paper','paper_trading','high','ranging',0.2,45,NULL,NULL,'RSI is stretched but the range boundary has not been confirmed by a rejection candle.','A range break would invalidate the mean-reversion premise immediately.',ARRAY['strategy confidence below threshold','conflicting indicators'],118,'Range conditions with a stretched oscillator but no confirmation yet.','RSI below 30 on the 5m with prior reactions at this level.','Price is still pressing lower highs on the 1m.','Range boundary unconfirmed; volatility expanding.','A false range assumption in high volatility can produce fast adverse moves.','Volatility 75 has been range-bound for roughly four hours.','wait'),
    ('R_100','EMA Trend Continuation','15m','buy',76,'strong','{"technical_indicators":82,"market_regime":75,"historical_strategy_strength":71,"ml_probability":null,"risk_adjustment":-8,"final":76}',78,1638.4,1636.2,1640.1,1622.5,1662.0,1684.5,2.1,'active','paper','paper_validated','high','trending_up',12,180,1642.77,0.27,'Price pulled back into the 21 EMA while the 50/200 EMA stack remains bullish.','Loss of the 21 EMA on a closing basis would end the continuation thesis.',ARRAY[]::text[],96,'Pullback continuation inside an established uptrend.','EMA stack aligned bullish; ADX above 25; higher lows intact.','RSI approaching overbought on the lower timeframe.','Trend maturity is uncertain after an extended leg.','Wide synthetic volatility requires a stop beyond normal ATR distance.','Volatility 100 has trended up for most of the session.','moderate_setup'),
    ('EURUSD','EMA Trend Continuation','15m','buy',68,'moderate','{"technical_indicators":72,"market_regime":70,"historical_strategy_strength":64,"ml_probability":null,"risk_adjustment":-5,"final":68}',71,1.0836,1.0831,1.0841,1.0808,1.0872,1.0904,1.8,'active','research','validation_pending','moderate','trending_up',34,240,1.0842,0.06,'London-session continuation above the prior day high with supportive momentum.','Reversal on US data release could reclaim the breakout level.',ARRAY[]::text[],41,'Session breakout continuation with modest momentum support.','Price holding above prior day high; MACD positive.','Momentum is decelerating into the New York overlap.','Economic-event risk is not yet modelled by the engine.','Spread widening around releases can affect stop integrity.','Euro strength has persisted through the London session.','moderate_setup'),
    ('BOOM500','Spike Reversion','5m','no_trade',24,'low','{"technical_indicators":30,"market_regime":22,"historical_strategy_strength":26,"ml_probability":null,"risk_adjustment":-12,"final":24}',31,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'pending','research','experimental','extreme','spike_risk',1,30,NULL,NULL,'Spike timing distribution is unstable and the reward does not justify spike exposure.','Spike arrival is stochastic; adverse timing produces immediate large losses.',ARRAY['unstable volatility','poor R:R','insufficient historical evidence'],17,'No qualified setup. Spike exposure is not justified at present.','None material.','Drip phase remains intact with no reversion evidence.','Spike arrival timing cannot be predicted reliably.','Boom spike exposure can exceed planned risk within a single tick.','Boom 500 is in an extended drip phase.','avoid'),
    ('CRASH1000','Spike Reversion','5m','sell',61,'moderate','{"technical_indicators":66,"market_regime":58,"historical_strategy_strength":55,"ml_probability":null,"risk_adjustment":-9,"final":61}',62,4890.2,4886.0,4894.0,4921.0,4842.0,4796.0,1.6,'active','research','experimental','extreme','spike_risk',6,60,4884.62,0.11,'Post-drip exhaustion with a bearish structure break on the 1m.','A continued drip phase invalidates the short bias quickly.',ARRAY[]::text[],23,'Short bias with limited historical evidence behind it.','1m structure break lower; momentum turning down.','Drip phases can extend far beyond expectation.','Sample size is well below the reliability threshold.','Crash markets can gap against positions without warning.','Crash 1000 is late in a drip phase.','weak_setup'),
    ('STEPIDX','ATR Breakout','15m','wait',49,'low','{"technical_indicators":52,"market_regime":50,"historical_strategy_strength":48,"ml_probability":null,"risk_adjustment":-4,"final":49}',52,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'pending','backtest','backtested','moderate','low_volatility',3,60,NULL,NULL,'ATR is compressed below the breakout threshold; no expansion signal yet.','Breakouts from compression frequently fail without volume confirmation.',ARRAY['strategy confidence below threshold'],64,'Compression phase — waiting for range expansion.','Structure is neutral.','No directional evidence.','Breakout direction is unknown during compression.','Premature entries in compression tend to be stopped out.','Step Index volatility is unusually low.','wait'),
    ('XAUUSD','ATR Breakout','1h','sell',58,'moderate','{"technical_indicators":61,"market_regime":57,"historical_strategy_strength":52,"ml_probability":null,"risk_adjustment":-7,"final":58}',59,2388.5,2386.0,2391.0,2402.0,2368.0,2348.0,1.5,'active','research','experimental','high','high_volatility',88,300,2384.62,0.16,'Rejection from the prior swing high with ADX confirming expansion.','A macro headline could reverse gold sharply against the position.',ARRAY[]::text[],38,'Short from resistance with moderate confirmation.','Rejection wick at resistance; ADX rising.','The broader trend remains upward on the daily.','Counter-trend trades carry elevated failure risk.','Gold reacts violently to macro releases.','Gold is consolidating below a multi-week high.','weak_setup'),
    ('GBPJPY','EMA Trend Continuation','15m','neutral',51,'low','{"technical_indicators":54,"market_regime":49,"historical_strategy_strength":50,"ml_probability":null,"risk_adjustment":-2,"final":51}',53,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'pending','research','experimental','extreme','high_volatility',9,90,NULL,NULL,'Indicators disagree across timeframes; no directional edge identified.','Whipsaw risk is elevated in current conditions.',ARRAY['conflicting indicators'],29,'Mixed evidence; no directional call.','Bullish on the 1h.','Bearish on the 15m.','Timeframe conflict is unresolved.','Extreme range makes stop placement inefficient.','GBPJPY is unusually volatile this session.','wait')
  ) AS v(symbol, strat, timeframe, direction, conf, grade, breakdown, quality, entry, zlow, zhigh, sl, tp1, tp2, rr, status, mode, vstat, risk, regime, age_min, exp_min, cprice, upl, reason, frisk, notrade, sample, ai_sum, ai_bull, ai_bear, ai_unc, ai_risk, ai_ctx, ai_rec)
  JOIN public.instruments i ON i.symbol = v.symbol
  JOIN public.strategies st ON st.name = v.strat
  RETURNING id, direction, confidence_score
)
INSERT INTO public.risk_checks (signal_id, overall_status, checks, notes)
SELECT s.id,
  (CASE WHEN s.confidence_score >= 70 THEN 'approved' WHEN s.confidence_score >= 50 THEN 'caution' ELSE 'rejected' END)::public.risk_gate_status,
  jsonb_build_array(
    jsonb_build_object('name','Excessive volatility','status', CASE WHEN s.confidence_score >= 60 THEN 'pass' ELSE 'warn' END),
    jsonb_build_object('name','Risk/reward quality','status', CASE WHEN s.confidence_score >= 60 THEN 'pass' ELSE 'fail' END),
    jsonb_build_object('name','Market data freshness','status','pass'),
    jsonb_build_object('name','Historical evidence','status', CASE WHEN s.confidence_score >= 65 THEN 'pass' ELSE 'warn' END),
    jsonb_build_object('name','Strategy validation level','status','warn'),
    jsonb_build_object('name','Indicator agreement','status', CASE WHEN s.confidence_score >= 60 THEN 'pass' ELSE 'fail' END),
    jsonb_build_object('name','Correlation exposure','status','pass'),
    jsonb_build_object('name','Abnormal market behaviour','status','pass'),
    jsonb_build_object('name','System health','status','pass')
  ),
  'Demo risk-gate evaluation. Replaced by the Cossa Signals Python risk gate in production.'
FROM s;

-- Indicators for every demo signal
INSERT INTO public.signal_indicators (signal_id, indicator_name, indicator_value, indicator_display, interpretation, direction, weight, timeframe)
SELECT sg.id, d.name, d.val, d.disp, d.interp, d.dir::public.indicator_direction, d.w, sg.timeframe
FROM public.signals sg
CROSS JOIN (VALUES
  ('RSI (14)',28.4,'28.4','Oversold relative to the recent distribution.','bullish',0.2),
  ('MACD',-0.42,'-0.42','Histogram still below zero but contracting.','bearish',0.15),
  ('EMA 21 / 50',1.0,'21 > 50','Short-term structure above medium-term.','bullish',0.2),
  ('ATR (14)',1.84,'1.84','Volatility above the 30-period average.','neutral',0.1),
  ('ADX (14)',18.6,'18.6','Below 25 — trend strength is weak.','neutral',0.15),
  ('Stochastic RSI',12.0,'12.0','Deeply oversold.','bullish',0.1),
  ('Market structure',0.0,'Lower highs','Structure has not yet turned.','bearish',0.1)
) AS d(name, val, disp, interp, dir, w)
WHERE sg.is_demo = true;

-- Agent votes
INSERT INTO public.signal_votes (signal_id, agent_name, vote, confidence, reason)
SELECT sg.id, a.agent, a.vote::public.agent_vote, a.conf, a.reason
FROM public.signals sg
CROSS JOIN (VALUES
  ('Market Regime Agent','neutral',55,'Range conditions reduce directional conviction.'),
  ('Technical Analysis Agent','buy',64,'Oscillator stretch with prior reaction levels nearby.'),
  ('Synthetic Index Agent','neutral',50,'Behaviour is within normal synthetic bounds.'),
  ('Risk Officer','reject',72,'Risk/reward does not clear the minimum threshold.'),
  ('Backtest Validator','neutral',48,'Sample size is below the reliability threshold.'),
  ('Signal Director','neutral',52,'Consensus does not support release as a trade.')
) AS a(agent, vote, conf, reason)
WHERE sg.is_demo = true;

-- Performance snapshots
INSERT INTO public.performance_snapshots (instrument_id, strategy_id, timeframe, mode, period, total_trades, wins, losses, break_even,
  win_rate, average_win, average_loss, profit_factor, avg_rr_ratio, max_drawdown, sharpe_ratio, total_return_pct, benchmark_return_pct,
  beats_benchmark, sample_reliable, avg_signal_duration_minutes, is_demo)
SELECT i.id, st.id, p.tf, p.mode::public.signal_mode, p.period, p.tt, p.w, p.l, p.be, p.wr, p.aw, p.al, p.pf, p.rr, p.dd, p.sh, p.tr, p.br,
  p.tr > p.br, p.tt >= 30, p.dur, true
FROM (VALUES
  ('R_75','RSI Mean Reversion','5m','paper','90d',118,64,49,5,54.2,1.42,-1.06,1.31,1.62,-11.4,0.84,14.6,6.2,72.0),
  ('R_100','EMA Trend Continuation','15m','paper','90d',96,55,38,3,57.3,2.18,-1.44,1.52,1.94,-9.8,1.06,21.4,8.1,145.0),
  ('EURUSD','EMA Trend Continuation','15m','backtest','180d',41,22,18,1,53.7,0.94,-0.71,1.28,1.71,-7.2,0.66,8.9,4.4,210.0),
  ('BOOM500','Spike Reversion','5m','backtest','90d',17,7,10,0,41.2,3.10,-2.44,0.89,1.21,-18.6,-0.22,-6.4,3.1,38.0),
  ('CRASH1000','Spike Reversion','5m','research','60d',23,11,12,0,47.8,2.62,-2.18,1.10,1.34,-15.2,0.18,3.2,2.6,44.0),
  ('STEPIDX','ATR Breakout','15m','backtest','120d',64,33,29,2,51.6,1.18,-0.96,1.19,1.48,-8.4,0.52,7.1,3.8,165.0),
  ('XAUUSD','ATR Breakout','1h','research','120d',38,19,18,1,50.0,1.88,-1.52,1.16,1.44,-12.1,0.41,5.6,9.4,320.0)
) AS p(symbol, strat, tf, mode, period, tt, w, l, be, wr, aw, al, pf, rr, dd, sh, tr, br, dur)
JOIN public.instruments i ON i.symbol = p.symbol
JOIN public.strategies st ON st.name = p.strat;

-- Service heartbeats
INSERT INTO public.service_heartbeats (service_name, status, last_heartbeat, message) VALUES
('python_signal_engine','offline',NULL,'Not yet connected to this environment.'),
('market_data_feed','offline',NULL,'Awaiting provider connection.'),
('database','healthy',now(),'Operational.'),
('realtime','healthy',now(),'Operational.'),
('signal_writer','offline',NULL,'Awaiting Python engine connection.'),
('notification_worker','offline',NULL,'Not yet implemented.'),
('ai_service','offline',NULL,'AI analyst not yet connected.');