import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, Gauge, Radio, ShieldCheck } from "lucide-react";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { EmptyState, PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { FreshnessBadge } from "@/components/cossa/badges";
import { useInstruments, usePlatformControls } from "@/hooks/useCossa";
import { supabase } from "@/integrations/supabase/client";
import type { RankedOpportunity } from "@/lib/opportunity-scanner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center — Cossa Signals" },
      { name: "description", content: "Current Deriv market evidence, opportunity posture and live data freshness." },
    ],
  }),
  component: DashboardPage,
});

type ScannerResponse = {
  ok: boolean;
  error?: string;
  generatedAt?: string;
  opportunities?: RankedOpportunity[];
};

function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const { data: instruments = [] } = useInstruments();
  const { data: controls } = usePlatformControls();
  const scanner = useQuery({
    queryKey: ["opportunity-scanner", "dashboard"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const response = await fetch("/api/opportunity-scanner", { headers: { authorization: `Bearer ${token}` } });
      const payload = (await response.json()) as ScannerResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to load current Cossa evidence");
      return payload;
    },
  });

  const opportunities = scanner.data?.opportunities ?? [];
  const actionable = opportunities.filter(
    (item) => item.qualified && (item.direction === "buy" || item.direction === "sell"),
  );
  const waiting = opportunities.filter(
    (item) => !item.qualified || item.direction === "wait" || item.direction === "no_trade",
  );
  const liveInstruments = instruments
    .filter((item) => item.provider === "deriv" && !item.is_demo && Boolean(item.last_data_at))
    .sort((a, b) => new Date(b.last_data_at ?? 0).getTime() - new Date(a.last_data_at ?? 0).getTime());
  const staleSeconds = controls?.stale_threshold_seconds ?? 600;
  const now = Date.now();
  const staleLive = liveInstruments.filter((item) => {
    const age = item.last_data_at ? now - new Date(item.last_data_at).getTime() : Number.POSITIVE_INFINITY;
    return age > staleSeconds * 1000;
  });
  const currentEvidence = opportunities.slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cossa Signals · Command Center"
        title="Live market posture at a glance"
        description="Current Deriv feeds and immutable Cossa evidence. Legacy demo rows are excluded from this operational view."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Qualified BUY / SELL" value={actionable.length} tone="gold" hint="Executable only after risk gates" />
        <StatCard label="Wait / Rejected" value={waiting.length} tone="caution" hint="Visible by design" />
        <StatCard
          label="Signal delivery"
          value={controls?.signals_enabled ? "Enabled" : "Paused"}
          tone={controls?.signals_enabled ? "bullish" : "bearish"}
          hint="Global signal control"
        />
        <StatCard
          label="Live Deriv feeds"
          value={liveInstruments.length === 0 ? "Offline" : staleLive.length === 0 ? `${liveInstruments.length} live` : `${staleLive.length} stale`}
          tone={liveInstruments.length === 0 || staleLive.length > 0 ? "bearish" : "bullish"}
          hint={liveInstruments.length === 0 ? "No current Deriv-backed instruments" : "Based on real instrument timestamps"}
        />
      </div>

      {scanner.isError ? (
        <div className="rounded-xl border border-bearish/40 bg-bearish/5 p-4 text-sm text-bearish">
          {scanner.error instanceof Error ? scanner.error.message : "Unable to load current evidence"}
        </div>
      ) : null}

      <Panel gold>
        <PanelHeader
          title="Current Opportunity Scanner"
          subtitle={`${opportunities.length} current evidence sets · ${actionable.length} qualified BUY/SELL`}
          action={<Link to="/scanner" className="text-xs font-medium text-primary hover:underline">Open full scanner →</Link>}
        />
        {scanner.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Scanning current market evidence…</p>
        ) : currentEvidence.length === 0 ? (
          <EmptyState title="No current evidence" description="The live pipeline is connected, but no current evidence set is available yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-2.5">Market</th><th className="px-3 py-2.5">Decision</th><th className="px-3 py-2.5">Signal</th><th className="px-3 py-2.5">Data</th><th className="px-3 py-2.5">R:R</th><th className="px-3 py-2.5">Structure</th><th className="px-3 py-2.5">Status</th><th className="px-4 py-2.5">Chart</th></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {currentEvidence.map((item) => (
                  <tr key={item.id} className="hover:bg-surface/30">
                    <td className="px-4 py-3"><span className="numeric font-semibold">{item.symbol}</span><span className="ml-2 text-muted-foreground">{item.timeframe}</span></td>
                    <td className="px-3 py-3 font-semibold uppercase">{item.direction.replace("_", " ")}</td>
                    <td className="numeric px-3 py-3">{item.confidenceScore.toFixed(0)}%</td>
                    <td className="numeric px-3 py-3">{item.dataConfidenceScore == null ? "—" : `${item.dataConfidenceScore.toFixed(0)}%`}</td>
                    <td className="numeric px-3 py-3">{item.riskRewardRatio?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-3">{item.structure?.trend ?? "—"} / {item.structure?.breakout ?? "—"}</td>
                    <td className="px-3 py-3"><span className={item.qualified ? "text-bullish" : "text-caution"}>{item.qualified ? "QUALIFIED" : "WAIT / REJECTED"}</span></td>
                    <td className="px-4 py-3"><Link to="/trading" search={{ symbol: item.symbol, timeframe: item.timeframe }} className="font-medium text-primary hover:underline">Open chart →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Current market structure" subtitle="Derived from the same closed-candle evidence used by the scanner" />
          {currentEvidence.length === 0 ? (
            <EmptyState title="No structure yet" description="Structure appears as closed-candle evidence is processed." />
          ) : (
            <ul className="divide-y divide-border/60">
              {currentEvidence.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                  <span><span className="numeric font-semibold">{item.symbol}</span><span className="ml-2 text-muted-foreground">{item.timeframe}</span></span>
                  <span className="text-right"><span className="font-medium">{item.structure?.trend ?? "unavailable"}</span><span className="ml-2 text-muted-foreground">breakout {item.structure?.breakout ?? "—"}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Live data pipeline" subtitle="Freshness from real Deriv instrument timestamps" />
          {liveInstruments.length === 0 ? (
            <EmptyState title="No live Deriv feed" description="No current real Deriv-backed instrument timestamp is available." />
          ) : (
            <ul className="divide-y divide-border/60">
              {liveInstruments.slice(0, 10).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                  <span className="flex items-center gap-2"><Database className="size-3.5 text-muted-foreground" /><span className="numeric font-medium">{item.symbol}</span><span className="text-muted-foreground">Deriv</span></span>
                  <span className="flex items-center gap-3"><span className="numeric text-muted-foreground">{item.current_price ?? "—"}</span><FreshnessBadge timestamp={item.last_data_at} staleSeconds={staleSeconds} /></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Current stance" subtitle="Latest deterministic direction across current evidence" />
        {opportunities.length === 0 ? (
          <EmptyState icon={<Radio className="size-5" />} title="Engine monitoring" description="No current decision evidence is available yet." />
        ) : (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {opportunities.slice(0, 20).map((item) => (
              <Link key={item.id} to="/trading" search={{ symbol: item.symbol, timeframe: item.timeframe }} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs hover:border-border-gold">
                <span className="numeric font-medium">{item.symbol}</span>
                <span className={item.direction === "buy" ? "text-bullish" : item.direction === "sell" ? "text-bearish" : "text-caution"}>{item.direction.replace("_", " ").toUpperCase()}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> Execution remains server risk-gated.
          <Gauge className="ml-2 size-3.5 text-primary" /> Data Confidence and structure are shown from immutable evidence.
        </div>
      </Panel>
    </div>
  );
}
