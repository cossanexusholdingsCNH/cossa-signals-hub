-- COSSA SIGNALS — UNIFIED EXECUTION MODES
-- Additive evolution: the same execution lifecycle can operate in demo or live environments.
-- Environment selects the provider adapter; execution mode selects automation/confirmation behavior.

ALTER TYPE public.execution_mode ADD VALUE IF NOT EXISTS 'auto';

-- Existing paper_auto rows remain valid for backwards compatibility.
-- New unified accounts/orders should use `auto`; account_environment determines demo vs live.
--
-- The original confirmation CHECK was created without an explicit constraint name.
-- PostgreSQL therefore generated the name. Do not guess that generated name: discover and
-- remove only the CHECK constraint whose definition governs execution_mode + confirmation_required.
DO $migration$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'execution_orders'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%execution_mode%'
      AND pg_get_constraintdef(c.oid) ILIKE '%confirmation_required%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.execution_orders DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END
$migration$;

ALTER TABLE public.execution_orders
  DROP CONSTRAINT IF EXISTS execution_orders_confirmation_mode_check;

ALTER TABLE public.execution_orders
  ADD CONSTRAINT execution_orders_confirmation_mode_check
  CHECK (
    (execution_mode IN ('paper_auto','auto') AND confirmation_required = false)
    OR
    (execution_mode NOT IN ('paper_auto','auto') AND confirmation_required = true)
  ) NOT VALID;

-- Validate after installation. Existing rows that were valid under the old rule remain valid,
-- and the new `auto` mode follows the same no-confirmation behavior as automatic demo execution.
ALTER TABLE public.execution_orders
  VALIDATE CONSTRAINT execution_orders_confirmation_mode_check;

COMMENT ON COLUMN public.trading_accounts.execution_mode IS
  'Execution behavior. `auto` is environment-neutral: demo uses simulated provider execution; live uses authenticated provider execution. account_environment selects demo vs live.';
