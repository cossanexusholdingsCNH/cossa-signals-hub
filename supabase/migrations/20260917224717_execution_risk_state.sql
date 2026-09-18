-- COSSA SIGNALS — EXECUTION RISK STATE
-- Additive only. Supports deterministic position sizing and fail-closed risk gates.

CREATE TABLE IF NOT EXISTS public.trading_account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  equity numeric NOT NULL CHECK (equity > 0),
  balance numeric NOT NULL CHECK (balance > 0),
  available_balance numeric,
  currency text NOT NULL,
  open_positions integer NOT NULL DEFAULT 0 CHECK (open_positions >= 0),
  provider_timestamp timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS trading_account_snapshots_account_time_idx
  ON public.trading_account_snapshots(trading_account_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.trading_daily_risk_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  trading_date date NOT NULL,
  start_of_day_equity numeric NOT NULL CHECK (start_of_day_equity > 0),
  realized_pnl numeric NOT NULL DEFAULT 0,
  peak_equity numeric,
  lowest_equity numeric,
  trades_opened integer NOT NULL DEFAULT 0 CHECK (trades_opened >= 0),
  trades_closed integer NOT NULL DEFAULT 0 CHECK (trades_closed >= 0),
  loss_limit_triggered boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trading_account_id, trading_date)
);

CREATE INDEX IF NOT EXISTS trading_daily_risk_state_account_date_idx
  ON public.trading_daily_risk_state(trading_account_id, trading_date DESC);

ALTER TABLE public.trading_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_daily_risk_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.trading_account_snapshots TO authenticated;
GRANT SELECT ON public.trading_daily_risk_state TO authenticated;
GRANT ALL ON public.trading_account_snapshots TO service_role;
GRANT ALL ON public.trading_daily_risk_state TO service_role;

CREATE POLICY "users read own account snapshots"
  ON public.trading_account_snapshots FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trading_accounts a
    WHERE a.id = trading_account_id
      AND (a.user_id = (select auth.uid()) OR (select public.is_staff((select auth.uid()))))
  ));

CREATE POLICY "users read own daily risk state"
  ON public.trading_daily_risk_state FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trading_accounts a
    WHERE a.id = trading_account_id
      AND (a.user_id = (select auth.uid()) OR (select public.is_staff((select auth.uid()))))
  ));

CREATE TRIGGER trading_daily_risk_state_updated
  BEFORE UPDATE ON public.trading_daily_risk_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.trading_account_snapshots IS
  'Server-written broker/demo account equity snapshots used for risk calculations and reconciliation.';
COMMENT ON TABLE public.trading_daily_risk_state IS
  'Per-account daily loss baseline and execution counters. Workers must fail closed when this state is missing or stale.';
