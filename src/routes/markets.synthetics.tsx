import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { InstrumentTable } from "@/components/cossa/InstrumentTable";
import { RegimeBadge } from "@/components/cossa/badges";
import { useInstruments, useMarketRegimes, usePlatformControls } from "@/hooks/useCossa";
import { relativeAge } from "@/lib/cossa";

export const Route = createFileRoute("/markets/synthetics")({
  head: () => ({
    meta: [
      { title: "Synthetic Indices Intelligence — Cossa Signals" },
      {
        name: "description",
        content:
          "Volatility indices, Boom/Crash, Bull/Bear and Step Index behaviour — spike risk, reset windows and regime classification.",
      },
      { property: "og:title", content: "Synthetic Indices Intelligence — Cossa Signals" },
      { property: "og:description", content: "Spike-aware analysis of Deriv synthetic instruments." },
    ],
  }),
  component: SyntheticsPage,
});

function SyntheticsPage() {
  return (
    <RequireAuth>
      <SyntheticsContent />
    </RequireAuth>
  );
}

function SyntheticsContent() {
  const { data: instruments, isLoading, isError } = useInstruments();
  const { data: regimes } = useMarketRegimes();
  const { data: controls } = usePlatformControls();

  const synth = (instruments ?? []).filter((i) => i.asset_class === "synthetic_index");
  const ids = new Set(synth.map((i) => i.id));
  const synthRegimes = (regimes ?? []).filter((r) => ids.has(r.instrument_id)).slice(0, 12);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Market intelligence"
        title="Synthetic indices"
        description="Synthetic instruments are statistically defined, not news-driven. Volatility indices trend and mean-revert on their own clock; Boom and Crash carry asymmetric spike risk that dominates any directional read."
      />

      <Panel>
        <PanelHeader title="Covered synthetics" subtitle="Provider, validation status and data freshness" />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load instruments.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading instruments…</p>
        ) : (
          <InstrumentTable
            instruments={synth}
            {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})}
            emptyTitle="No synthetic indices configured yet"
            emptyDescription="Awaiting the signal engine to register synthetic coverage."
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Current synthetic regimes" subtitle="Includes spike risk and reset windows" />
        {synthRegimes.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Awaiting market data — no synthetic regime classification yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {synthRegimes.map((r) => (
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
        <PanelHeader title="Instrument families" subtitle="What makes each behave differently" />
        <ul className="space-y-2 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <li>
            · <span className="text-foreground">Volatility indices (R_10 – R_100, 1HZ variants)</span> — constant
            statistical volatility; the number is the volatility level, not a quality ranking.
          </li>
          <li>
            · <span className="text-foreground">Boom / Crash 500 & 1000</span> — steady drift punctuated by sharp
            opposite spikes. Spike risk is treated as a hard risk-gate input.
          </li>
          <li>
            · <span className="text-foreground">Bull / Bear</span> — directional bias with sudden counter-moves.
          </li>
          <li>
            · <span className="text-foreground">Step Index / RDBULL</span> — fixed step behaviour; useful for
            structure, unforgiving on stop placement.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
