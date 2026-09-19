-- COSSA SIGNALS — DATA CONFIDENCE FOUNDATION
-- Additive only. No existing production rows are deleted or rewritten.

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS data_confidence_score numeric,
  ADD COLUMN IF NOT EXISTS data_confidence_breakdown jsonb;

ALTER TABLE public.signals
  DROP CONSTRAINT IF EXISTS signals_data_confidence_score_check;
ALTER TABLE public.signals
  ADD CONSTRAINT signals_data_confidence_score_check
  CHECK (data_confidence_score IS NULL OR data_confidence_score BETWEEN 0 AND 100);

ALTER TABLE public.signal_evidence
  ADD COLUMN IF NOT EXISTS data_confidence_score numeric,
  ADD COLUMN IF NOT EXISTS data_confidence_breakdown jsonb;

ALTER TABLE public.signal_evidence
  DROP CONSTRAINT IF EXISTS signal_evidence_data_confidence_score_check;
ALTER TABLE public.signal_evidence
  ADD CONSTRAINT signal_evidence_data_confidence_score_check
  CHECK (data_confidence_score IS NULL OR data_confidence_score BETWEEN 0 AND 100);

ALTER TABLE public.platform_controls
  ADD COLUMN IF NOT EXISTS minimum_data_confidence numeric NOT NULL DEFAULT 80;

ALTER TABLE public.platform_controls
  DROP CONSTRAINT IF EXISTS platform_controls_minimum_data_confidence_check;
ALTER TABLE public.platform_controls
  ADD CONSTRAINT platform_controls_minimum_data_confidence_check
  CHECK (minimum_data_confidence BETWEEN 0 AND 100);

COMMENT ON COLUMN public.signals.data_confidence_score IS
  'Operational data-quality score (0-100) derived from observable feed coverage, freshness and continuity. Not a probability that the trade will win.';
COMMENT ON COLUMN public.signals.data_confidence_breakdown IS
  'Versioned components, diagnostics and reasons behind data_confidence_score.';
COMMENT ON COLUMN public.signal_evidence.data_confidence_score IS
  'Immutable operational data-quality score attached to the exact signal evidence window.';
COMMENT ON COLUMN public.signal_evidence.data_confidence_breakdown IS
  'Versioned data-quality components and diagnostics for the immutable evidence window.';
COMMENT ON COLUMN public.platform_controls.minimum_data_confidence IS
  'Configurable minimum operational data-confidence score required by execution risk checks.';
