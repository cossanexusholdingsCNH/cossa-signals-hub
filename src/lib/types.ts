/** Explicit view models for Cossa Signals reads. Populated by the backend only. */

import type {
  DataStatus,
  Direction,
  RegimeType,
  RiskGateStatus,
  ValidationStatus,
} from "@/lib/cossa";

export type Num = number | null;
export type Str = string | null;

export interface InstrumentRef {
  id: string;
  symbol: string;
  display_name: string;
  asset_class: string;
  category: string;
  risk_rating: string;
  validation_status: ValidationStatus;
  current_price: Num;
  last_data_at: Str;
  provider: string;
  timeframe_default: string;
}

export interface Instrument extends InstrumentRef {
  market_status: string;
  enabled: boolean;
  minimum_sample_required: number;
  description: Str;
  market_characteristics: Str;
  data_source: Str;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConfidenceBreakdown {
  technical_indicators?: Num;
  market_regime?: Num;
  historical_strategy_strength?: Num;
  ml_probability?: Num;
  risk_adjustment?: Num;
  final?: Num;
}

export interface Signal {
  id: string;
  instrument_id: string;
  strategy_id: Str;
  strategy_name: Str;
  timeframe: string;
  direction: Direction;
  confidence_score: Num;
  confidence_grade: Str;
  confidence_breakdown: ConfidenceBreakdown | null;
  signal_quality_score: Num;
  entry_price: Num;
  entry_zone_low: Num;
  entry_zone_high: Num;
  stop_loss: Num;
  take_profit_1: Num;
  take_profit_2: Num;
  take_profit_3: Num;
  risk_reward_ratio: Num;
  status: string;
  mode: string;
  validation_status: ValidationStatus;
  risk_rating: string;
  market_regime: RegimeType;
  opened_at: string;
  expires_at: Str;
  closed_at: Str;
  current_price: Num;
  unrealized_return_pct: Num;
  realized_return_pct: Num;
  invalidation_reason: Str;
  signal_reason: Str;
  failure_risk: Str;
  no_trade_reasons: string[];
  ai_summary: Str;
  ai_bullish_evidence: Str;
  ai_bearish_evidence: Str;
  ai_uncertainty: Str;
  ai_risk_explanation: Str;
  ai_market_context: Str;
  ai_recommendation: Str;
  historical_sample_size: Num;
  source: Str;
  source_version: Str;
  model_version: Str;
  strategy_version: Str;
  data_timestamp: Str;
  calculated_at: Str;
  is_demo: boolean;
  created_at: string;
  instrument: InstrumentRef | null;
}

export interface SignalIndicator {
  id: string;
  signal_id: string;
  indicator_name: string;
  indicator_value: Num;
  indicator_display: Str;
  interpretation: Str;
  direction: "bullish" | "bearish" | "neutral";
  weight: Num;
  timeframe: Str;
}

export interface SignalVote {
  id: string;
  signal_id: string;
  agent_name: string;
  vote: "buy" | "sell" | "neutral" | "reject";
  confidence: Num;
  reason: Str;
}

export interface RiskCheckItem {
  name: string;
  status: "pass" | "warn" | "fail";
}

export interface RiskCheck {
  id: string;
  signal_id: string;
  overall_status: RiskGateStatus;
  checks: RiskCheckItem[];
  notes: Str;
  created_at: string;
}

export interface MarketRegime {
  id: string;
  instrument_id: string;
  timeframe: string;
  regime: RegimeType;
  confidence_score: Num;
  detected_at: string;
  expires_at: Str;
  instrument: { symbol: string; display_name: string; category: string } | null;
}

export interface Strategy {
  id: string;
  name: string;
  description: Str;
  strategy_family: string;
  applicable_instruments: string[];
  applicable_timeframes: string[];
  validation_status: ValidationStatus;
  minimum_trades: number;
  version: string;
  enabled: boolean;
}

export interface PerformanceSnapshot {
  id: string;
  instrument_id: Str;
  strategy_id: Str;
  timeframe: Str;
  mode: string;
  period: Str;
  total_trades: number;
  wins: number;
  losses: number;
  break_even: number;
  win_rate: Num;
  average_win: Num;
  average_loss: Num;
  profit_factor: Num;
  avg_rr_ratio: Num;
  max_drawdown: Num;
  sharpe_ratio: Num;
  total_return_pct: Num;
  benchmark_return_pct: Num;
  beats_benchmark: boolean | null;
  sample_reliable: boolean;
  avg_signal_duration_minutes: Num;
  calculated_at: string;
  is_demo: boolean;
  instrument: { symbol: string; display_name: string; asset_class: string } | null;
  strategy: { name: string; strategy_family: string; validation_status: ValidationStatus } | null;
}

export interface DataHealthRow {
  id: string;
  provider: string;
  instrument_id: Str;
  last_received_at: Str;
  latency_ms: number | null;
  status: DataStatus;
  instrument: { symbol: string } | null;
}

export interface Heartbeat {
  id: string;
  service_name: string;
  status: DataStatus;
  last_heartbeat: Str;
  message: Str;
}

export interface PlatformControls {
  id: string;
  signals_enabled: boolean;
  alerts_enabled: boolean;
  maintenance_mode: boolean;
  emergency_message: Str;
  stale_threshold_seconds: number;
  minimum_sample_size: number;
  updated_at: string;
}

export interface TierRow {
  id: string;
  tier: "free" | "basic" | "pro";
  name: string;
  description: Str;
  price_monthly: number;
  currency: string;
  features: string[];
  entitlements: Record<string, unknown>;
  sort_order: number;
}
