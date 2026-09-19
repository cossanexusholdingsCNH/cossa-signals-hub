-- COSSA SIGNALS — UNIFIED EXECUTION MODES
-- Additive evolution: the same execution lifecycle can operate in demo or live environments.
-- Environment selects the provider adapter; execution mode selects automation/confirmation behavior.
--
-- IMPORTANT: this migration only adds the enum value. PostgreSQL can reject use of a newly-added
-- enum value inside the same transaction. The dependent CHECK constraint is installed by the
-- immediately-following migration after this enum addition has committed.

ALTER TYPE public.execution_mode ADD VALUE IF NOT EXISTS 'auto';
