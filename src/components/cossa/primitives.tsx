import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { MINIMUM_RELIABLE_SAMPLE, RISK_DISCLAIMER } from "@/lib/cossa";

export function Panel({
  children,
  className,
  gold,
}: {
  children: ReactNode;
  className?: string;
  gold?: boolean;
}) {
  return <div className={cn(gold ? "panel-gold" : "panel", className)}>{children}</div>;
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "bullish" | "bearish" | "caution" | "gold";
}) {
  const toneClass = {
    default: "text-foreground",
    bullish: "text-bullish",
    bearish: "text-bearish",
    caution: "text-caution",
    gold: "text-primary",
  }[tone];
  return (
    <div className="panel px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={cn("numeric mt-1.5 text-xl font-semibold sm:text-2xl", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function SampleGuard({ totalTrades }: { totalTrades: number | null | undefined }) {
  if ((totalTrades ?? 0) >= MINIMUM_RELIABLE_SAMPLE) return null;
  return (
    <p className="text-[11px] leading-snug text-caution">
      Insufficient sample size — not statistically reliable yet ({totalTrades ?? 0} of{" "}
      {MINIMUM_RELIABLE_SAMPLE} trades).
    </p>
  );
}

export function RiskDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-muted-foreground", className)}>
      {RISK_DISCLAIMER}
    </p>
  );
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="numeric text-right text-xs font-medium">{value}</span>
    </div>
  );
}
