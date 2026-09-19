import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Filter, Radar, ShieldCheck, TriangleAlert } from "lucide-react";

import { EmptyState, PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { supabase } from "@/integrations/supabase/client";
import type { RankedOpportunity, ScannerSettings } from "@/lib/opportunity-scanner";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Opportunity Scanner — Cossa Signals" },
      {
        name: "description",
        content: "Deterministic cross-market opportunity ranking from immutable Cossa Signals evidence.",
      },
    ],
  }),
  component: ScannerPage,
});

type ScannerResponse = {
  ok: boolean;
  error?: string;
  generatedAt?: string;
  settings?: ScannerSettings;
  summary?: { total: number; qualified: number; rejected: number };
  opportunities?: RankedOpportunity[];
};

type StatusFilter = "all" | "qualified" | "rejected";

type DirectionFilter = "all" | "buy" | "sell" | "wait";

function ScannerPage() {
  return (
    <RequireAuth>
      <ScannerWorkspace />
    </RequireAuth>
  );
}

function ScannerWorkspace() {
  const [assetClass, setAssetClass] = useState("all");
  const [timeframe, setTimeframe] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [search, setSearch] = useState("");

  const scanner = useQuery({
    queryKey: ["opportunity-scanner"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const response = await fetch("/api/opportunity-scanner", {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as ScannerResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Opportunity scanner failed");
      return payload;
    },
  });

  const opportunities = scanner.data?.opportunities ?? [];
  const assetClasses = useMemo(
    () => [...new Set(opportunities.map((item) => item.assetClass))].sort(),
    [opportunities],
  );
  const timeframes = useMemo(
    () => [...new Set(opportunities.map((item) => item.timeframe))].sort(),
    [opportunities],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return opportunities.filter((item) => {
      if (assetClass !== "all" && item.assetClass !== assetClass) return false;
      if (timeframe !== "all" && item.timeframe !== timeframe) return false;
      if (status === "qualified" && !item.qualified) return false;
      if (status === "rejected" && item.qualified) return false;
      if (direction === "buy" && item.direction !== "buy") return false;
      if (direction === "sell" && item.direction !== "sell") return false;
      if (direction === "wait" && item.direction !== "wait" && item.direction !== "no_trade") return false;
      if (needle && !`${item.symbol} ${item.displayName} ${item.category}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [assetClass, direction, opportunities, search, status, timeframe]);

  const qualified = opportunities.filter((item) => item.qualified);
  const averageScore = qualified.length
    ? qualified.reduce((sum, item) => sum + item.opportunityScore, 0) / qualified.length
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cross-market intelligence"
        title="Opportunity Scanner"
        description="Ranks the latest immutable evidence per instrument and timeframe. Priority Score is a deterministic ranking metric — not a probability of profit. Rejected and NO-TRADE candidates remain visible."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Evidence sets" value={opportunities.length} hint="Latest per instrument / timeframe" />
        <StatCard label="Qualified" value={qualified.length} tone="bullish" hint="Clears every configured gate" />
        <StatCard label="Rejected / wait" value={opportunities.length - qualified.length} tone="caution" hint="Visible by design" />
        <StatCard label="Avg qualified priority" value={qualified.length ? averageScore.toFixed(1) : "—"} tone="gold" hint="Ranking score, not win probability" />
      </div>

      {scanner.isError ? (
        <div className="rounded-xl border border-bearish/40 bg-bearish/5 p-4 text-sm text-bearish">
          {scanner.error instanceof Error ? scanner.error.message : "Unable to load scanner"}
        </div>
      ) : null}

      <Panel>
        <PanelHeader
          title="Scanner controls"
          subtitle="Filter the ranked evidence without changing the engine's qualification rules"
        />
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-muted-foreground">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="R_100, Boom, forex…"
              className="mt-1 w-full rounded-md border bg-background px-2.5 py-2 text-sm text-foreground"
            />
          </label>
          <SelectFilter label="Asset class" value={assetClass} onChange={setAssetClass} values={assetClasses} />
          <SelectFilter label="Timeframe" value={timeframe} onChange={setTimeframe} values={timeframes} />
          <label className="text-xs text-muted-foreground">
            Qualification
            <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="qualified">Qualified only</option>
              <option value="rejected">Rejected / wait</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Direction
            <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)}>
              <option value="all">All</option>
              <option value="buy">BUY</option>
              <option value="sell">SELL</option>
              <option value="wait">WAIT / NO TRADE</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel gold>
        <PanelHeader
          title="Ranked opportunities"
          subtitle={`${filtered.length} shown · refreshed every 30 seconds`}
          action={<span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Filter className="size-3" /> deterministic-v1</span>}
        />
        {scanner.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Scanning persisted evidence…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Radar className="size-5" />}
            title="No evidence matches these filters"
            description="The scanner does not manufacture a setup when qualification gates are not met."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-xs">
              <thead className="border-b border-border bg-surface/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Rank / market</th>
                  <th className="px-3 py-2.5">Decision</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Signal</th>
                  <th className="px-3 py-2.5">Data</th>
                  <th className="px-3 py-2.5">R:R</th>
                  <th className="px-3 py-2.5">Structure</th>
                  <th className="px-3 py-2.5">Regime</th>
                  <th className="px-3 py-2.5">Qualification</th>
                  <th className="px-4 py-2.5">Evidence age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((item) => {
                  const rank = opportunities.findIndex((candidate) => candidate.id === item.id) + 1;
                  return (
                    <tr key={item.id} className="align-top hover:bg-surface/30">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className="numeric mt-0.5 w-6 text-muted-foreground">#{rank}</span>
                          <div>
                            <p className="numeric font-semibold text-foreground">{item.symbol}</p>
                            <p className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground">{item.displayName}</p>
                            <p className="mt-0.5 text-[10px] uppercase text-muted-foreground">{item.assetClass} · {item.timeframe}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <DecisionBadge direction={item.direction} />
                      </td>
                      <td className="px-3 py-3">
                        <p className="numeric text-base font-semibold text-primary">{item.opportunityScore.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground">priority only</p>
                      </td>
                      <td className="numeric px-3 py-3">{item.confidenceScore.toFixed(1)}</td>
                      <td className="numeric px-3 py-3">{item.dataConfidenceScore == null ? "—" : item.dataConfidenceScore.toFixed(1)}</td>
                      <td className="numeric px-3 py-3">{item.riskRewardRatio == null ? "—" : item.riskRewardRatio.toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{item.structure?.trend ?? "unavailable"}</p>
                        <p className="text-[10px] text-muted-foreground">breakout {item.structure?.breakout ?? "—"}</p>
                      </td>
                      <td className="px-3 py-3">{item.regime.replaceAll("_", " ")}</td>
                      <td className="max-w-80 px-3 py-3">
                        {item.qualified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-bullish/30 px-2 py-1 text-[10px] font-medium text-bullish"><ShieldCheck className="size-3" /> QUALIFIED</span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full border border-caution/30 px-2 py-1 text-[10px] font-medium text-caution"><TriangleAlert className="size-3" /> REJECTED / WAIT</span>
                            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{item.qualificationReasons.slice(0, 3).join(" · ")}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">{ageLabel(item.dataTo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {scanner.data?.settings ? <SettingsDisclosure settings={scanner.data.settings} /> : null}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  values,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  values: string[];
}) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All</option>
        {values.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function DecisionBadge({ direction }: { direction: RankedOpportunity["direction"] }) {
  const className =
    direction === "buy"
      ? "border-bullish/30 text-bullish"
      : direction === "sell"
        ? "border-bearish/30 text-bearish"
        : "border-caution/30 text-caution";
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${className}`}>{direction.replace("_", " ")}</span>;
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

function SettingsDisclosure({ settings }: { settings: ScannerSettings }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3 text-[11px] text-muted-foreground">
      Qualification gates: Signal Confidence ≥ <strong className="text-foreground">{settings.minSignalConfidence}</strong> · Data Confidence ≥ <strong className="text-foreground">{settings.minDataConfidence}</strong> · R:R ≥ <strong className="text-foreground">{settings.minRiskReward}</strong> · evidence age ≤ <strong className="text-foreground">{settings.maxCandidateAgeMinutes}m</strong>. Ranking weights: signal {Math.round(settings.weights.signal * 100)}%, data {Math.round(settings.weights.data * 100)}%, R:R {Math.round(settings.weights.riskReward * 100)}%, structure {Math.round(settings.weights.structure * 100)}%, regime {Math.round(settings.weights.regime * 100)}%.
    </div>
  );
}
