-- COSSA SIGNALS — EXECUTION-READY FOUNDATION
-- Additive only. This schema supports signals-only, automatic paper/demo execution,
-- and explicitly confirmed live execution. It does not itself place broker orders.

CREATE TYPE public.execution_mode AS ENUM ('signals_only','paper_auto','live_manual');
CREATE TYPE public.execution_order_status AS ENUM ('draft','awaiting_confirmation','approved','submitted','filled','partially_filled','rejected','cancelled','closed','failed');
CREATE TYPE public.execution_side AS ENUM ('buy','sell');

CREATE TABLE public.trading_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  provider_account_ref text,
  account_label text NOT NULL,
  account_environment text NOT NULL CHECK (account_environment IN ('demo','live')),
  execution_mode public.execution_mode NOT NULL DEFAULT 'signals_only',
  enabled boolean NOT NULL DEFAULT false,
  currency text,
  max_risk_per_trade_pct numeric NOT NULL DEFAULT 1 CHECK (max_risk_per_trade_pct > 0 AND max_risk_per_trade_pct <= 5),
  max_daily_loss_pct numeric NOT NULL DEFAULT 3 CHECK (max_daily_loss_pct > 0 AND max_daily_loss_pct <= 20),
  max_open_positions integer NOT NULL DEFAULT 3 CHECK (max_open_positions BETWEEN 1 AND 100),
  emergency_stop boolean NOT NULL DEFAULT false,
  last_reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, provider_account_ref)
);

CREATE TABLE public.execution_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trading_account_id uuid NOT NULL REFERENCES public.trading_accounts(id) ON DELETE RESTRICT,
  signal_id uuid REFERENCES public.signals(id) ON DELETE SET NULL,
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  side public.execution_side NOT NULL,
  execution_mode public.execution_mode NOT NULL,
  status public.execution_order_status NOT NULL DEFAULT 'draft',
  requested_entry numeric,
  stop_loss numeric,
  take_profit_1 numeric,
  take_profit_2 numeric,
  take_profit_3 numeric,
  requested_amount numeric NOT NULL CHECK (requested_amount > 0),
  requested_currency text,
  risk_pct numeric,
  risk_reward_ratio numeric,
  provider_order_ref text,
  provider_position_ref text,
  idempotency_key text NOT NULL UNIQUE,
  confirmation_required boolean NOT NULL DEFAULT true,
  confirmed_by uuid,
  confirmed_at timestamptz,
  submitted_at timestamptz,
  filled_at timestamptz,
  closed_at timestamptz,
  average_fill_price numeric,
  close_price numeric,
  realized_pnl numeric,
  rejection_reason text,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (execution_mode = 'paper_auto' AND confirmation_required = false)
    OR (execution_mode <> 'paper_auto' AND confirmation_required = true)
  ),
  CHECK (
    execution_mode <> 'live_manual'
    OR status IN ('draft','awaiting_confirmation','approved','submitted','filled','partially_filled','rejected','cancelled','closed','failed')
  )
);

CREATE TABLE public.execution_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.execution_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_status public.execution_order_status,
  new_status public.execution_order_status,
  provider_event_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.execution_risk_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.execution_orders(id) ON DELETE CASCADE,
  approved boolean NOT NULL DEFAULT false,
  account_enabled boolean NOT NULL DEFAULT false,
  emergency_stop_clear boolean NOT NULL DEFAULT false,
  daily_loss_gate_clear boolean NOT NULL DEFAULT false,
  open_position_gate_clear boolean NOT NULL DEFAULT false,
  per_trade_risk_gate_clear boolean NOT NULL DEFAULT false,
  signal_quality_gate_clear boolean NOT NULL DEFAULT false,
  stale_data_gate_clear boolean NOT NULL DEFAULT false,
  duplicate_order_gate_clear boolean NOT NULL DEFAULT false,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  rejection_reasons text[] NOT NULL DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trading_accounts_user_idx ON public.trading_accounts(user_id);
CREATE INDEX execution_orders_user_created_idx ON public.execution_orders(user_id, created_at DESC);
CREATE INDEX execution_orders_account_status_idx ON public.execution_orders(trading_account_id, status);
CREATE INDEX execution_orders_signal_idx ON public.execution_orders(signal_id);
CREATE INDEX execution_orders_instrument_idx ON public.execution_orders(instrument_id);
CREATE INDEX execution_events_order_created_idx ON public.execution_events(order_id, created_at DESC);
CREATE INDEX execution_risk_checks_order_idx ON public.execution_risk_checks(order_id);

ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_risk_checks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.trading_accounts TO authenticated;
GRANT SELECT ON public.execution_orders TO authenticated;
GRANT SELECT ON public.execution_events TO authenticated;
GRANT SELECT ON public.execution_risk_checks TO authenticated;
GRANT ALL ON public.trading_accounts TO service_role;
GRANT ALL ON public.execution_orders TO service_role;
GRANT ALL ON public.execution_events TO service_role;
GRANT ALL ON public.execution_risk_checks TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

CREATE POLICY "users read own trading accounts"
  ON public.trading_accounts FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.is_staff((select auth.uid()))));
CREATE POLICY "users create own trading accounts"
  ON public.trading_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "users update own trading accounts"
  ON public.trading_accounts FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "users read own execution orders"
  ON public.execution_orders FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.is_staff((select auth.uid()))));
CREATE POLICY "users read own execution events"
  ON public.execution_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.execution_orders eo WHERE eo.id = order_id AND (eo.user_id = (select auth.uid()) OR (select public.is_staff((select auth.uid()))))));
CREATE POLICY "users read own execution risk checks"
  ON public.execution_risk_checks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.execution_orders eo WHERE eo.id = order_id AND (eo.user_id = (select auth.uid()) OR (select public.is_staff((select auth.uid()))))));

CREATE TRIGGER trading_accounts_updated BEFORE UPDATE ON public.trading_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER execution_orders_updated BEFORE UPDATE ON public.execution_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.trading_accounts IS 'Execution configuration only. Broker/API secrets must remain in server-side secret storage, never this table.';
COMMENT ON TABLE public.execution_orders IS 'Auditable order intents. paper_auto may execute automatically in demo/paper environments; live_manual requires explicit confirmation before submission.';
COMMENT ON TABLE public.execution_risk_checks IS 'Mandatory pre-execution risk-gate evidence. Execution workers must fail closed if any required gate is false.';
