-- COSSA SIGNALS — UNIFIED EXECUTION LIFECYCLE
-- Additive only. One normalized position/fill ledger for demo and live accounts.
-- Provider adapters write normalized events into these tables; downstream P&L and performance
-- logic does not care whether the provider execution environment is demo or live.

CREATE TYPE public.execution_environment AS ENUM ('demo','live');
CREATE TYPE public.execution_position_status AS ENUM ('opening','open','closing','closed','failed');
CREATE TYPE public.execution_close_reason AS ENUM ('take_profit','stop_loss','manual','provider','risk_stop','error');

CREATE TABLE public.execution_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trading_account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES public.execution_orders(id) ON DELETE RESTRICT,
  signal_id uuid REFERENCES public.signals(id) ON DELETE SET NULL,
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  environment public.execution_environment NOT NULL,
  provider text NOT NULL,
  side public.execution_side NOT NULL,
  status public.execution_position_status NOT NULL DEFAULT 'opening',
  quantity numeric NOT NULL CHECK (quantity > 0),
  entry_price numeric,
  current_price numeric,
  stop_loss numeric,
  take_profit_1 numeric,
  take_profit_2 numeric,
  take_profit_3 numeric,
  provider_order_ref text,
  provider_position_ref text,
  unrealized_pnl numeric NOT NULL DEFAULT 0,
  realized_pnl numeric,
  opened_at timestamptz,
  closed_at timestamptz,
  close_price numeric,
  close_reason public.execution_close_reason,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.execution_fills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.execution_orders(id) ON DELETE RESTRICT,
  position_id uuid REFERENCES public.execution_positions(id) ON DELETE SET NULL,
  environment public.execution_environment NOT NULL,
  provider text NOT NULL,
  provider_fill_ref text,
  side public.execution_side NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  price numeric NOT NULL CHECK (price > 0),
  fee numeric NOT NULL DEFAULT 0,
  fee_currency text,
  filled_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_fill_ref)
);

CREATE INDEX execution_positions_account_status_idx
  ON public.execution_positions(trading_account_id, status);
CREATE INDEX execution_positions_user_created_idx
  ON public.execution_positions(user_id, created_at DESC);
CREATE INDEX execution_positions_instrument_status_idx
  ON public.execution_positions(instrument_id, status);
CREATE INDEX execution_fills_order_time_idx
  ON public.execution_fills(order_id, filled_at DESC);
CREATE INDEX execution_fills_position_time_idx
  ON public.execution_fills(position_id, filled_at DESC);

ALTER TABLE public.execution_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_fills ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.execution_positions TO authenticated;
GRANT SELECT ON public.execution_fills TO authenticated;
GRANT ALL ON public.execution_positions TO service_role;
GRANT ALL ON public.execution_fills TO service_role;

CREATE POLICY "users read own execution positions"
  ON public.execution_positions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.is_staff((select auth.uid()))));

CREATE POLICY "users read own execution fills"
  ON public.execution_fills FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.execution_orders eo
    WHERE eo.id = order_id
      AND (eo.user_id = (select auth.uid()) OR (select public.is_staff((select auth.uid()))))
  ));

CREATE TRIGGER execution_positions_updated
  BEFORE UPDATE ON public.execution_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.execution_positions IS
  'Normalized position ledger shared by demo and live provider adapters. Business logic must not fork by environment after adapter normalization.';
COMMENT ON TABLE public.execution_fills IS
  'Immutable normalized fill ledger for demo and live execution. Provider-specific payloads belong in metadata; common execution logic uses normalized columns.';
