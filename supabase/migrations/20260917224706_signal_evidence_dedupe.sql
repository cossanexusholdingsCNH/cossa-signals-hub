-- COSSA SIGNALS — SIGNAL EVIDENCE + DEDUPLICATION GUARD
-- Additive only. No existing signal, user, market-data or execution rows are modified.

CREATE TABLE IF NOT EXISTS public.signal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE CHECK (length(fingerprint) = 64),
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.market_data_providers(id) ON DELETE RESTRICT,
  provider_symbol text NOT NULL,
  timeframe text NOT NULL CHECK (timeframe IN ('1m','5m','15m','30m','1h','4h','1d')),
  engine_version text NOT NULL,
  data_from timestamptz NOT NULL,
  data_to timestamptz NOT NULL,
  candle_count integer NOT NULL CHECK (candle_count >= 60),
  direction public.signal_direction NOT NULL,
  regime public.regime_type NOT NULL DEFAULT 'unknown',
  confidence_score numeric NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  entry numeric,
  entry_zone_low numeric,
  entry_zone_high numeric,
  stop_loss numeric,
  take_profit_1 numeric,
  take_profit_2 numeric,
  take_profit_3 numeric,
  risk_reward_ratio numeric,
  indicators jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons text[] NOT NULL DEFAULT '{}',
  no_trade_reasons text[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_to > data_from)
);

CREATE INDEX IF NOT EXISTS signal_evidence_instrument_time_idx
  ON public.signal_evidence(instrument_id, timeframe, data_to DESC);
CREATE INDEX IF NOT EXISTS signal_evidence_direction_time_idx
  ON public.signal_evidence(direction, generated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS signal_evidence_closed_window_dedupe_idx
  ON public.signal_evidence(instrument_id, provider_id, timeframe, data_to, engine_version);

ALTER TABLE public.signal_evidence ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.signal_evidence TO authenticated;
GRANT ALL ON public.signal_evidence TO service_role;

CREATE POLICY "signal evidence authenticated read"
  ON public.signal_evidence FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE public.signal_evidence IS
  'Immutable deterministic evidence for signal decisions. Duplicate closed-candle evaluations are rejected by unique constraints; service-role writes only.';
