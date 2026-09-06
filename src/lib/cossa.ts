/**
 * Cossa Signals — shared display helpers and contracts.
 *
 * IMPORTANT: This module never calculates signals, confidence, quality scores
 * or performance metrics. The Cossa Signals Python engine is the only source of
 * truth for those values. Everything here is presentation only.
 */

export const MINIMUM_RELIABLE_SAMPLE = 30;
export const DEFAULT_STALE_SECONDS = 120;

export const RISK_DISCLAIMER =
  "Cossa Signals provides market information and trading signals for educational and informational purposes. It does not guarantee outcomes. Trading involves substantial risk of financial loss.";

export type Direction = "buy" | "sell" | "neutral" | "wait" | "no_trade";
export type ValidationStatus =
  | "experimental"
  | "backtested"
  | "validation_pending"
  | "paper_trading"
  | "paper_validated"
  | "live_verified"
  | "paused"
  | "rejected";
export type RegimeType =
  | "trending_up"
  | "trending_down"
  | "ranging"
  | "high_volatility"
  | "low_volatility"
  | "spike_risk"
  | "reset_window"
  | "breakout"
  | "unstable"
  | "unknown";
export type DataStatus = "healthy" | "delayed" | "stale" | "offline";
export type RiskGateStatus = "approved" | "caution" | "rejected";

export const DIRECTION_LABEL: Record<Direction, string> = {
  buy: "BUY",
  sell: "SELL",
  neutral: "NEUTRAL",
  wait: "WAIT",
  no_trade: "NO TRADE",
};

export const VALIDATION_LABEL: Record<ValidationStatus, string> = {
  experimental: "Experimental",
  backtested: "Backtested",
  validation_pending: "Validation Pending",
  paper_trading: "Paper Trading",
  paper_validated: "Paper Validated",
  live_verified: "Live Verified",
  paused: "Paused",
  rejected: "Rejected",
};

export const REGIME_LABEL: Record<RegimeType, string> = {
  trending_up: "Trending Up",
  trending_down: "Trending Down",
  ranging: "Range Market",
  high_volatility: "High Volatility",
  low_volatility: "Low Volatility",
  spike_risk: "Spike Risk",
  reset_window: "Reset Window",
  breakout: "Breakout",
  unstable: "Unstable",
  unknown: "Unknown",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  target_1_hit: "Target 1 Hit",
  target_2_hit: "Target 2 Hit",
  target_3_hit: "Target 3 Hit",
  closed_win: "Closed — Win",
  closed_loss: "Closed — Loss",
  break_even: "Break Even",
  expired: "Expired",
  cancelled: "Cancelled",
  invalidated: "Invalidated",
};

export const MODE_LABEL: Record<string, string> = {
  research: "Research",
  backtest: "Backtest",
  paper: "Paper",
  live_verified: "Live Verified",
};

export const CATEGORY_LABEL: Record<string, string> = {
  volatility: "Volatility",
  volatility_1s: "Volatility (1s)",
  boom: "Boom",
  crash: "Crash",
  bull_bear: "Bull/Bear",
  daily_reset: "Daily Reset",
  step: "Step",
  forex_major: "Forex Major",
  forex_minor: "Forex Minor",
  forex_exotic: "Forex Exotic",
  metals: "Metals",
};

/** Signal quality score bands — bands only, never a calculation. */
export function qualityBand(score: number | null | undefined) {
  if (score == null) return { label: "Not scored", tone: "neutral" as const };
  if (score >= 90) return { label: "Exceptional setup", tone: "bullish" as const };
  if (score >= 80) return { label: "Strong", tone: "bullish" as const };
  if (score >= 70) return { label: "Qualified", tone: "caution" as const };
  if (score >= 60) return { label: "Watch", tone: "caution" as const };
  return { label: "No trade", tone: "bearish" as const };
}

export function isSampleReliable(totalTrades: number | null | undefined) {
  return (totalTrades ?? 0) >= MINIMUM_RELIABLE_SAMPLE;
}

export function relativeAge(iso: string | null | undefined): string {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function freshnessOf(
  iso: string | null | undefined,
  staleSeconds: number = DEFAULT_STALE_SECONDS,
): { status: DataStatus; label: string } {
  if (!iso) return { status: "offline", label: "NO DATA" };
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds <= 20) return { status: "healthy", label: "LIVE" };
  if (seconds <= staleSeconds) return { status: "delayed", label: relativeAge(iso) };
  return { status: "stale", label: "STALE DATA" };
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const decimals = abs < 10 ? 4 : abs < 1000 ? 2 : 2;
  return value.toLocaleString("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatNum(value: number | null | undefined, digits = 2): string {
  if (value == null) return "—";
  return value.toFixed(digits);
}

export function formatMoney(value: number | null | undefined, currency = "ZAR"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
