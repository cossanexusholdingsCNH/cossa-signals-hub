-- COSSA SIGNALS — REAL MARKET DATA FOUNDATION
-- Additive/reversible-by-follow-up migration. No demo or user rows are modified.
-- This migration intentionally creates the storage/control plane only.
-- Provider workers and the signal engine are wired separately after validation.

CREATE TABLE IF NOT EXISTS public.market_data_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('deriv','forex','market_data','fallback')),
  enabled boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  base_url text,
  websocket_url text,
  supports_ticks boolean NOT NULL DEFAULT false,
  supports_candles boolean NOT NULL DEFAULT true,
  supports_streaming boolean NOT NULL DEFAULT false,
  rate_limit_per_minute integer,
  timeout_ms integer NOT NULL DEFAULT 10000 CHECK (timeout_ms BETWEEN 1000 AND 120000),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  circuit_open_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.instrument_provider_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.market_data_providers(id) ON DELETE CASCADE,
  provider_symbol text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument_id, provider_id),
  UNIQUE (provider_id, provider_symbol)
);

CREATE UNIQUE INDEX IF NOT EXISTS instrument_provider_one_primary_idx
  ON public.instrument_provider_mappings(instrument_id)
  WHERE is_primary AND enabled;

CREATE INDEX IF NOT EXISTS instrument_provider_provider_idx
  ON public.instrument_provider_mappings(provider_id, enabled);

CREATE TABLE IF NOT EXISTS public.market_ticks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.market_data_providers(id) ON DELETE RESTRICT,
  provider_symbol text NOT NULL,
  tick_at timestamptz NOT NULL,
  price numeric NOT NULL CHECK (price > 0),
  bid numeric,
  ask numeric,
  epoch bigint,
  source_sequence text,
  received_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS market_ticks_dedupe_idx
  ON public.market_ticks(instrument_id, provider_id, tick_at, price);
CREATE INDEX IF NOT EXISTS market_ticks_instrument_time_idx
  ON public.market_ticks(instrument_id, tick_at DESC);
CREATE INDEX IF NOT EXISTS market_ticks_provider_time_idx
  ON public.market_ticks(provider_id, tick_at DESC);

CREATE TABLE IF NOT EXISTS public.market_candles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.market_data_providers(id) ON DELETE RESTRICT,
  provider_symbol text NOT NULL,
  timeframe text NOT NULL CHECK (timeframe IN ('1m','5m','15m','30m','1h','4h','1d')),
  open_time timestamptz NOT NULL,
  close_time timestamptz NOT NULL,
  open numeric NOT NULL CHECK (open > 0),
  high numeric NOT NULL CHECK (high > 0),
  low numeric NOT NULL CHECK (low > 0),
  close numeric NOT NULL CHECK (close > 0),
  volume numeric,
  tick_count integer,
  is_closed boolean NOT NULL DEFAULT true,
  received_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (close_time > open_time),
  CHECK (high >= GREATEST(open, close, low)),
  CHECK (low <= LEAST(open, close, high)),
  UNIQUE (instrument_id, provider_id, timeframe, open_time)
);

CREATE INDEX IF NOT EXISTS market_candles_instrument_tf_time_idx
  ON public.market_candles(instrument_id, timeframe, open_time DESC);
CREATE INDEX IF NOT EXISTS market_candles_provider_time_idx
  ON public.market_candles(provider_id, open_time DESC);

CREATE TABLE IF NOT EXISTS public.market_data_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.market_data_providers(id) ON DELETE RESTRICT,
  instrument_id uuid REFERENCES public.instruments(id) ON DELETE CASCADE,
  run_type text NOT NULL CHECK (run_type IN ('tick_stream','candle_backfill','candle_refresh','health_check')),
  status text NOT NULL CHECK (status IN ('running','succeeded','partial','failed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_received integer NOT NULL DEFAULT 0 CHECK (records_received >= 0),
  records_written integer NOT NULL DEFAULT 0 CHECK (records_written >= 0),
  records_rejected integer NOT NULL DEFAULT 0 CHECK (records_rejected >= 0),
  latency_ms integer,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_runs_provider_started_idx
  ON public.market_data_ingestion_runs(provider_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ingestion_runs_instrument_started_idx
  ON public.market_data_ingestion_runs(instrument_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.signal_engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  timeframe text NOT NULL,
  engine_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','no_trade','signal_created','failed','skipped')),
  data_from timestamptz,
  data_to timestamptz,
  candle_count integer NOT NULL DEFAULT 0 CHECK (candle_count >= 0),
  regime public.regime_type NOT NULL DEFAULT 'unknown',
  direction public.signal_direction NOT NULL DEFAULT 'wait',
  confidence_score numeric,
  risk_status public.risk_gate_status,
  signal_id uuid REFERENCES public.signals(id) ON DELETE SET NULL,
  no_trade_reasons text[] NOT NULL DEFAULT '{}',
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signal_engine_runs_instrument_started_idx
  ON public.signal_engine_runs(instrument_id, started_at DESC);
CREATE INDEX IF NOT EXISTS signal_engine_runs_status_started_idx
  ON public.signal_engine_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS signals_model_id_idx ON public.signals(model_id);
CREATE INDEX IF NOT EXISTS signals_strategy_id_idx ON public.signals(strategy_id);
CREATE INDEX IF NOT EXISTS watchlist_items_instrument_id_idx ON public.watchlist_items(instrument_id);

GRANT SELECT ON public.market_data_providers TO authenticated;
GRANT SELECT ON public.instrument_provider_mappings TO authenticated;
GRANT SELECT ON public.market_ticks TO authenticated;
GRANT SELECT ON public.market_candles TO authenticated;
GRANT SELECT ON public.market_data_ingestion_runs TO authenticated;
GRANT SELECT ON public.signal_engine_runs TO authenticated;
GRANT ALL ON public.market_data_providers TO service_role;
GRANT ALL ON public.instrument_provider_mappings TO service_role;
GRANT ALL ON public.market_ticks TO service_role;
GRANT ALL ON public.market_candles TO service_role;
GRANT ALL ON public.market_data_ingestion_runs TO service_role;
GRANT ALL ON public.signal_engine_runs TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER TABLE public.market_data_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_provider_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_ticks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_engine_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market providers staff read" ON public.market_data_providers FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));
CREATE POLICY "provider mappings staff read" ON public.instrument_provider_mappings FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));
CREATE POLICY "market ticks staff read" ON public.market_ticks FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));
CREATE POLICY "market candles authenticated read" ON public.market_candles FOR SELECT TO authenticated USING (true);
CREATE POLICY "ingestion runs staff read" ON public.market_data_ingestion_runs FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));
CREATE POLICY "engine runs staff read" ON public.signal_engine_runs FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));

CREATE TRIGGER market_data_providers_updated BEFORE UPDATE ON public.market_data_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER instrument_provider_mappings_updated BEFORE UPDATE ON public.instrument_provider_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.market_data_providers IS 'Editable provider registry. Secrets must never be stored here; use server environment variables/secrets.';
COMMENT ON TABLE public.instrument_provider_mappings IS 'Maps canonical Cossa instruments to provider-specific symbols without hard-coding provider names in application logic.';
COMMENT ON TABLE public.market_ticks IS 'Raw real-time ticks received from configured providers. Service-role writes only.';
COMMENT ON TABLE public.market_candles IS 'Normalized OHLC candle history used by deterministic analysis, backtests and signal generation.';
COMMENT ON TABLE public.market_data_ingestion_runs IS 'Operational audit trail for provider ingestion, latency, rejection and failure diagnostics.';
COMMENT ON TABLE public.signal_engine_runs IS 'Auditable decision trail for every signal-engine evaluation, including explicit no-trade outcomes.';
