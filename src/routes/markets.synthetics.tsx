import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { InstrumentTable } from "@/components/cossa/InstrumentTable";
import { useInstruments, usePlatformControls } from "@/hooks/useCossa";
import { supabase } from "@/integrations/supabase/client";
import type { RankedOpportunity } from "@/lib/opportunity-scanner";

export const Route = createFileRoute("/markets/synthetics")({
  head: () => ({
    meta: [
      { title: "Synthetic Indices Intelligence — Cossa Signals" },
      { name: "description", content: "Live Deriv synthetic markets, current Cossa evidence, chart access and execution readiness." },
    ],
  }),
  component: SyntheticsPage,
});

type ScannerResponse = { ok: boolean; error?: string; opportunities?: RankedOpportunity[] };

function SyntheticsPage() {
  return (
    <RequireAuth>
      <SyntheticsContent />
    </RequireAuth>
  );
}

function SyntheticsContent() {
  const { data: instruments, isLoading, isError } = useInstruments();
  const { data: controls } = usePlatformControls();
  const scanner = useQuery({
    queryKey: ["opportunity-scanner", "synthetics"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const response = await fetch("/api/opportunity-scanner", { headers: { authorization: `Bearer ${token}` } });
      const payload = (await response.json()) as ScannerResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to load current market evidence");
      return payload.opportunities ?? [];
    },
  });

  const liveSynth = (instruments ?? [])
    .filter((i) => i.asset_class === "synthetic_index" && i.provider === "deriv" && !i.is_demo && Boolean(i.last_data_at))
    .sort((a, b) => new Date(b.last_data_at ?? 0).getTime() - new Date(a.last_data_at ?? 0).getTime());
  const liveIds = new Set(liveSynth.map((i) => i.id));
  const evidence = (scanner.data ?? []).filter((item) => liveIds.has(item.instrumentId));
  const actionable = evidence.filter((item) => item.qualified && (item.direction === "buy" || item.direction === "sell"));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live Deriv market intelligence"
        title="Synthetic indices"
        description="Only current live Deriv-backed instruments are shown here. Click any instrument to open its chart in the Trading Terminal."
      />

      <Panel>
        <PanelHeader title="Live covered synthetics" subtitle={`${liveSynth.length} instruments with current real Deriv data`} />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load instruments.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading live instruments…</p>
        ) : (
          <InstrumentTable
            instruments={liveSynth}
            {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})}
            emptyTitle="No live Deriv synthetic feeds"
            emptyDescription="No current live Deriv-backed instruments are available."
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Current Cossa evidence" subtitle={`${actionable.length} qualified BUY/SELL setups · ${evidence.length} evidence sets`} />
        {scanner.isError ? (
          <p className="px-4 py-6 text-sm text-bearish">{scanner.error instanceof Error ? scanner.error.message : "Unable to load evidence"}</p>
        ) : evidence.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">The live feeds are running. The engine has not produced current evidence for these markets yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-2.5">Market</th><th className="px-3 py-2.5">Decision</th><th className="px-3 py-2.5">Signal</th><th className="px-3 py-2.5">Data</th><th className="px-3 py-2.5">R:R</th><th className="px-3 py-2.5">Structure</th><th className="px-4 py-2.5">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {evidence.slice(0, 20).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3"><span className="numeric font-semibold">{item.symbol}</span><span className="ml-2 text-muted-foreground">{item.timeframe}</span></td>
                    <td className="px-3 py-3 font-semibold uppercase">{item.direction.replace("_", " ")}</td>
                    <td className="numeric px-3 py-3">{item.confidenceScore.toFixed(0)}%</td>
                    <td className="numeric px-3 py-3">{item.dataConfidenceScore == null ? "—" : `${item.dataConfidenceScore.toFixed(0)}%`}</td>
                    <td className="numeric px-3 py-3">{item.riskRewardRatio?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-3">{item.structure?.trend ?? "—"} / {item.structure?.breakout ?? "—"}</td>
                    <td className="px-4 py-3"><Link to="/trading" search={{ symbol: item.symbol, timeframe: item.timeframe }} className="font-medium text-primary hover:underline">Open chart →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
