-- COSSA SIGNALS — IMMUTABLE MARKET STRUCTURE SNAPSHOTS
-- Additive only. Existing market, signal, execution and account rows are untouched.

CREATE TABLE IF NOT EXISTS public.market_structure_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.market_data_providers(id) ON DELETE RESTRICT,
  provider_symbol text NOT NULL,
  timeframe text NOT NULL CHECK (timeframe IN ('1m','5m','15m','30m','1h','4h','1d')),
  data_from timestamptz NOT NULL,
  data_to timestamptz NOT NULL,
  candle_count integer NOT NULL CHECK (candle_count >= 20),
  engine_version text NOT NULL,
  trend text NOT NULL CHECK (trend IN ('bullish','bearish','range','transition')),
  structure_label text NOT NULL CHECK (structure_label IN ('HH_HL','LH_LL','MIXED','INSUFFICIENT_SWINGS')),
  breakout text NOT NULL CHECK (breakout IN ('bullish','bearish','none')),
  current_price numeric NOT NULL CHECK (current_price > 0),
  atr numeric NOT NULL CHECK (atr >= 0),
  analysis jsonb NOT NULL,
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_to > data_from),
  UNIQUE (instrument_id, provider_id, timeframe, data_to, engine_version)
);

CREATE INDEX IF NOT EXISTS market_structure_instrument_time_idx
  ON public.market_structure_snapshots(instrument_id, timeframe, data_to DESC);
CREATE INDEX IF NOT EXISTS market_structure_trend_time_idx
  ON public.market_structure_snapshots(trend, generated_at DESC);

ALTER TABLE public.market_structure_snapshots ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.market_structure_snapshots TO authenticated;
GRANT ALL ON public.market_structure_snapshots TO service_role;

CREATE POLICY "market structure authenticated read"
  ON public.market_structure_snapshots FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE public.market_structure_snapshots IS
  'Immutable deterministic market-structure analysis derived only from closed candle evidence. Includes swing structure, support/resistance, breakout state and equal-level liquidity references; liquidity references are not order-book claims.';
