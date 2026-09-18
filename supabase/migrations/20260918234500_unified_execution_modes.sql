-- COSSA SIGNALS — UNIFIED EXECUTION MODES
-- Additive evolution: the same execution lifecycle can operate in demo or live environments.
-- Environment selects the provider adapter; execution mode selects automation/confirmation behavior.

ALTER TYPE public.execution_mode ADD VALUE IF NOT EXISTS 'auto';

-- Existing paper_auto rows remain valid for backwards compatibility.
-- New unified accounts/orders should use `auto`; the account_environment determines demo vs live.

ALTER TABLE public.execution_orders
  DROP CONSTRAINT IF EXISTS execution_orders_check;

ALTER TABLE public.execution_orders
  ADD CONSTRAINT execution_orders_confirmation_mode_check
  CHECK (
    (execution_mode IN ('paper_auto','auto') AND confirmation_required = false)
    OR
    (execution_mode NOT IN ('paper_auto','auto') AND confirmation_required = true)
  ) NOT VALID;

COMMENT ON COLUMN public.trading_accounts.execution_mode IS
  'Execution behavior. `auto` is environment-neutral: demo uses simulated provider execution; live uses authenticated provider execution. account_environment selects demo vs live.';
