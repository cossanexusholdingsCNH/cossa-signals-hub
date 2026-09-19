-- COSSA SIGNALS — OPPORTUNITY SCANNER CONTROLS
-- Additive only. Ranking controls stay editable in platform_controls rather than hard-coded.

ALTER TABLE public.platform_controls
  ADD COLUMN IF NOT EXISTS scanner_min_signal_confidence numeric NOT NULL DEFAULT 65,
  ADD COLUMN IF NOT EXISTS scanner_min_data_confidence numeric NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS scanner_min_risk_reward numeric NOT NULL DEFAULT 1.5,
  ADD COLUMN IF NOT EXISTS scanner_max_candidate_age_minutes integer NOT NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS scanner_weight_signal numeric NOT NULL DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS scanner_weight_data numeric NOT NULL DEFAULT 0.30,
  ADD COLUMN IF NOT EXISTS scanner_weight_risk_reward numeric NOT NULL DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS scanner_weight_structure numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS scanner_weight_regime numeric NOT NULL DEFAULT 0.10;

ALTER TABLE public.platform_controls
  DROP CONSTRAINT IF EXISTS platform_controls_scanner_thresholds_check,
  DROP CONSTRAINT IF EXISTS platform_controls_scanner_weights_range_check,
  DROP CONSTRAINT IF EXISTS platform_controls_scanner_weights_sum_check;

ALTER TABLE public.platform_controls
  ADD CONSTRAINT platform_controls_scanner_thresholds_check CHECK (
    scanner_min_signal_confidence BETWEEN 0 AND 100
    AND scanner_min_data_confidence BETWEEN 0 AND 100
    AND scanner_min_risk_reward > 0 AND scanner_min_risk_reward <= 20
    AND scanner_max_candidate_age_minutes BETWEEN 1 AND 10080
  ),
  ADD CONSTRAINT platform_controls_scanner_weights_range_check CHECK (
    scanner_weight_signal BETWEEN 0 AND 1
    AND scanner_weight_data BETWEEN 0 AND 1
    AND scanner_weight_risk_reward BETWEEN 0 AND 1
    AND scanner_weight_structure BETWEEN 0 AND 1
    AND scanner_weight_regime BETWEEN 0 AND 1
  ),
  ADD CONSTRAINT platform_controls_scanner_weights_sum_check CHECK (
    abs(
      scanner_weight_signal
      + scanner_weight_data
      + scanner_weight_risk_reward
      + scanner_weight_structure
      + scanner_weight_regime
      - 1
    ) <= 0.0001
  );

COMMENT ON COLUMN public.platform_controls.scanner_min_signal_confidence IS
  'Minimum deterministic Signal Confidence for a scanner candidate to qualify.';
COMMENT ON COLUMN public.platform_controls.scanner_min_data_confidence IS
  'Minimum operational Data Confidence for a scanner candidate to qualify.';
COMMENT ON COLUMN public.platform_controls.scanner_min_risk_reward IS
  'Minimum planned reward-to-risk ratio for a scanner candidate to qualify.';
COMMENT ON COLUMN public.platform_controls.scanner_max_candidate_age_minutes IS
  'Maximum age of immutable signal evidence before a scanner candidate is rejected as stale.';
