import { Link } from "@tanstack/react-router";
import { ShieldCheck, TriangleAlert } from "lucide-react";

import type { RankedOpportunity } from "@/lib/opportunity-scanner";

export function EvidenceMatrix({ opportunities }: { opportunities: RankedOpportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <div className="px-4 py-14 text-center">
        <p className="text-sm font-semibold">No current evidence matches these filters.</p>
        <p className="mt-1 text-xs text-muted-foreground">WAIT and NO-TRADE outputs remain visible when they exist.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-xs">
        <thead className="border-b border-border bg-surface/50 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Market</th>
            <th className="px-3 py-2.5">Decision</th>
            <th className="px-3 py-2.5">Entry</th>
            <th className="px-3 py-2.5">Stop</th>
            <th className="px-3 py-2.5">Target</th>
            <th className="px-3 py-2.5">Signal</th>
            <th className="px-3 py-2.5">Data</th>
            <th className="px-3 py-2.5">R:R</th>
            <th className="px-3 py-2.5">Regime</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-4 py-2.5">Age / chart</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {opportunities.map((item) => (
            <tr key={item.id} className="align-top hover:bg-surface/30">
              <td className="px-4 py-3">
                <p className="numeric font-semibold text-foreground">{item.symbol}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.displayName}</p>
                <p className="mt-0.5 text-[10px] uppercase text-muted-foreground">{item.category} · {item.timeframe}</p>
              </td>
              <td className="px-3 py-3"><DecisionBadge direction={item.direction} /></td>
              <td className="numeric px-3 py-3">{formatNumber(item.entry)}</td>
              <td className="numeric px-3 py-3">{formatNumber(item.stopLoss)}</td>
              <td className="numeric px-3 py-3">{formatNumber(item.takeProfit1)}</td>
              <td className="numeric px-3 py-3">{item.confidenceScore.toFixed(1)}</td>
              <td className="numeric px-3 py-3">{item.dataConfidenceScore == null ? "—" : item.dataConfidenceScore.toFixed(1)}</td>
              <td className="numeric px-3 py-3">{item.riskRewardRatio == null ? "—" : item.riskRewardRatio.toFixed(2)}</td>
              <td className="px-3 py-3">
                <p>{item.regime.replaceAll("_", " ")}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{item.structure?.trend ?? "structure unavailable"}</p>
              </td>
              <td className="max-w-72 px-3 py-3">
                {item.qualified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-bullish/30 px-2 py-1 text-[10px] font-medium text-bullish"><ShieldCheck className="size-3" /> QUALIFIED</span>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-caution/30 px-2 py-1 text-[10px] font-medium text-caution"><TriangleAlert className="size-3" /> WAIT / REJECTED</span>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{item.qualificationReasons.slice(0, 2).join(" · ")}</p>
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <p className="text-[11px] text-muted-foreground">{ageLabel(item.dataTo)}</p>
                <Link
                  to="/trading"
                  search={{ symbol: item.symbol, timeframe: item.timeframe }}
                  className="mt-1.5 inline-block text-[11px] font-medium text-primary hover:underline"
                >
                  Open chart →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DecisionBadge({ direction }: { direction: RankedOpportunity["direction"] }) {
  const className = direction === "buy"
    ? "border-bullish/30 text-bullish"
    : direction === "sell"
      ? "border-bearish/30 text-bearish"
      : "border-caution/30 text-caution";
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${className}`}>{direction.replace("_", " ")}</span>;
}

function formatNumber(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function ageLabel(value: string) {
  const ageMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ageMs)) return "unknown";
  const minutes = Math.max(0, Math.floor(ageMs / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
