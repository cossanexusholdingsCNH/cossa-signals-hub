import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { InstrumentTable } from "@/components/cossa/InstrumentTable";
import { RegimeBadge } from "@/components/cossa/badges";
import { useInstruments, useMarketRegimes, usePlatformControls } from "@/hooks/useCossa";
import { relativeAge } from "@/lib/cossa";

export const Route = createFileRoute("/markets/forex")({
  head: () => ({
    meta: [
      { title: "Forex Intelligence — Cossa Signals" },
      {
        name: "description",
        content:
          "Session behaviour, volatility structure and regime detection across the forex pairs covered by Cossa Signals.",
      },
      { property: "og:title", content: "Forex Intelligence — Cossa Signals" },
      { property: "og:description", content: "Regime-aware forex coverage with transparent data provenance." },
    ],
  }),
  component: ForexPage,
});

function ForexPage() {
  return (
    <RequireAuth>
      <ForexContent />
    </RequireAuth>
  );
}

function ForexContent() {
  const { data: instruments, isLoading, isError } = useInstruments();
  const { data: regimes } = useMarketRegimes();
  const { data: controls } = usePlatformControls();

  const forex = (instruments ?? []).filter((i) => i.asset_class === "forex");
  const forexIds = new Set(forex.map((i) => i.id));
  const forexRegimes = (regimes ?? []).filter((r) => forexIds.has(r.instrument_id)).slice(0, 12);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Market intelligence"
        title="Forex"
        description="Forex behaves around sessions, liquidity and macro releases. Cossa Signals classifies regime before it considers direction — a clean trend and a choppy range are never traded the same way."
      />

      <Panel>
        <PanelHeader title="Covered pairs" subtitle="Provider, validation status and data freshness" />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load instruments.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading pairs…</p>
        ) : (
          <InstrumentTable
            instruments={forex}
            {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})}
            emptyTitle="No forex pairs configured yet"
            emptyDescription="Awaiting the signal engine to register forex coverage."
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Current forex regimes" subtitle="Latest classification per pair and timeframe" />
        {forexRegimes.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Awaiting market data — no forex regime classification yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {forexRegimes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <span>
                  <span className="numeric font-semibold">{r.instrument?.symbol ?? "—"}</span>
                  <span className="ml-2 text-muted-foreground">{r.timeframe}</span>
                </span>
                <span className="flex items-center gap-3">
                  <RegimeBadge regime={r.regime} />
                  <span className="text-muted-foreground">{relativeAge(r.detected_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="How we read forex" subtitle="Structural notes used by the engine" />
        <ul className="space-y-2 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <li>· Session overlap decides whether a breakout has the liquidity to hold.</li>
          <li>· Ranging regimes bias the engine toward WAIT rather than forcing a directional call.</li>
          <li>· Scheduled macro events raise failure risk, which lowers the signal quality score.</li>
          <li>· Every published pair carries its own validation status — experimental is never dressed up as verified.</li>
        </ul>
      </Panel>
    </div>
  );
}
