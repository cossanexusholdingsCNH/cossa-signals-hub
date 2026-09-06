import { cn } from "@/lib/utils";
import {
  DIRECTION_LABEL,
  REGIME_LABEL,
  STATUS_LABEL,
  MODE_LABEL,
  VALIDATION_LABEL,
  freshnessOf,
  type Direction,
  type RegimeType,
  type ValidationStatus,
} from "@/lib/cossa";

const chip =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap";

export function DirectionBadge({
  direction,
  size = "sm",
}: {
  direction: Direction;
  size?: "sm" | "lg";
}) {
  const tone: Record<Direction, string> = {
    buy: "border-bullish/40 bg-bullish/10 text-bullish",
    sell: "border-bearish/40 bg-bearish/10 text-bearish",
    neutral: "border-border bg-muted text-muted-foreground",
    wait: "border-caution/40 bg-caution/10 text-caution",
    no_trade: "border-border bg-muted text-neutral",
  };
  return (
    <span
      className={cn(
        chip,
        tone[direction],
        size === "lg" && "px-3 py-1 text-sm tracking-widest",
      )}
    >
      {DIRECTION_LABEL[direction]}
    </span>
  );
}

export function ValidationBadge({ status }: { status: ValidationStatus }) {
  const tone: Record<ValidationStatus, string> = {
    experimental: "border-border bg-muted text-muted-foreground",
    backtested: "border-border bg-muted text-foreground/80",
    validation_pending: "border-caution/40 bg-caution/10 text-caution",
    paper_trading: "border-caution/40 bg-caution/10 text-caution",
    paper_validated: "border-primary/40 bg-gold-dim text-primary",
    live_verified: "border-bullish/40 bg-bullish/10 text-bullish",
    paused: "border-border bg-muted text-muted-foreground",
    rejected: "border-bearish/40 bg-bearish/10 text-bearish",
  };
  return <span className={cn(chip, tone[status])}>{VALIDATION_LABEL[status]}</span>;
}

export function RegimeBadge({ regime }: { regime: RegimeType }) {
  const tone: Record<string, string> = {
    trending_up: "border-bullish/30 bg-bullish/10 text-bullish",
    trending_down: "border-bearish/30 bg-bearish/10 text-bearish",
    breakout: "border-primary/30 bg-gold-dim text-primary",
    spike_risk: "border-bearish/30 bg-bearish/10 text-bearish",
    high_volatility: "border-caution/30 bg-caution/10 text-caution",
    unstable: "border-caution/30 bg-caution/10 text-caution",
  };
  return (
    <span className={cn(chip, tone[regime] ?? "border-border bg-muted text-muted-foreground")}>
      {REGIME_LABEL[regime] ?? regime}
    </span>
  );
}

export function RiskBadge({ rating }: { rating: string }) {
  const tone: Record<string, string> = {
    low: "border-bullish/40 bg-bullish/10 text-bullish",
    moderate: "border-border bg-muted text-foreground/80",
    high: "border-caution/40 bg-caution/10 text-caution",
    extreme: "border-bearish/40 bg-bearish/10 text-bearish",
  };
  return <span className={cn(chip, tone[rating] ?? "border-border bg-muted")}>{rating} risk</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "border-bullish/40 bg-bullish/10 text-bullish",
    pending: "border-border bg-muted text-muted-foreground",
    closed_win: "border-bullish/40 bg-bullish/10 text-bullish",
    closed_loss: "border-bearish/40 bg-bearish/10 text-bearish",
    invalidated: "border-bearish/40 bg-bearish/10 text-bearish",
    expired: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span className={cn(chip, tone[status] ?? "border-border bg-muted text-muted-foreground")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className={cn(chip, "border-border bg-panel text-muted-foreground")}>
      {MODE_LABEL[mode] ?? mode}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className={cn(chip, "border-primary/50 bg-gold-dim text-primary")}>Demo data</span>
  );
}

export function FreshnessBadge({
  timestamp,
  staleSeconds,
}: {
  timestamp: string | null | undefined;
  staleSeconds?: number;
}) {
  const { status, label } = freshnessOf(timestamp, staleSeconds);
  const dot: Record<string, string> = {
    healthy: "bg-bullish",
    delayed: "bg-caution",
    stale: "bg-bearish",
    offline: "bg-neutral",
  };
  const text: Record<string, string> = {
    healthy: "text-bullish",
    delayed: "text-muted-foreground",
    stale: "text-bearish",
    offline: "text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide whitespace-nowrap",
        text[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot[status])} />
      {label}
    </span>
  );
}

export function ConfidenceMeter({
  score,
  grade,
}: {
  score: number | null | undefined;
  grade?: string | null;
}) {
  const value = score ?? 0;
  const tone =
    value >= 75 ? "bg-bullish" : value >= 60 ? "bg-primary" : value >= 45 ? "bg-caution" : "bg-neutral";
  return (
    <div className="min-w-[92px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="numeric text-sm font-semibold">
          {score == null ? "—" : `${Math.round(value)}%`}
        </span>
        {grade ? (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {grade}
          </span>
        ) : null}
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}
