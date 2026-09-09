import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import {
  DataRow,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  SampleGuard,
} from "@/components/cossa/primitives";
import {
  DemoBadge,
  FreshnessBadge,
  RegimeBadge,
  RiskBadge,
  ValidationBadge,
} from "@/components/cossa/badges";
import { SignalMatrix } from "@/components/cossa/SignalMatrix";
import {
  useAllSignals,
  useInstrument,
  useMarketRegimes,
  usePerformanceSnapshots,
  usePlatformControls,
} from "@/hooks/useCossa";
import {
  CATEGORY_LABEL,
  formatDate,
  formatNum,
  formatPct,
  formatPrice,
  isSampleReliable,
  relativeAge,
} from "@/lib/cossa";

export const Route = createFileRoute("/instruments/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol} — Cossa Signals` },
      {
        name: "description",
        content: `Instrument intelligence for ${params.symbol}: coverage, regime, signal history and measured performance from the Cossa Signals engine.`,
      },
      { property: "og:title", content: `${params.symbol} — Cossa Signals` },
      { property: "og:description", content: `Regime, signals and measured performance for ${params.symbol}.` },
    ],
  }),
  component: InstrumentPage,
});

function InstrumentPage() {
  return (
    <RequireAuth>
      <InstrumentContent />
    </RequireAuth>
  );
}

function InstrumentContent() {
  const { symbol } = Route.useParams();
  const { data: instrument, isLoading, isError } = useInstrument(symbol);
  const { data: signals } = useAllSignals(300);
  const { data: regimes } = useMarketRegimes();
  const { data: snapshots } = usePerformanceSnapshots();
  const { data: controls } = usePlatformControls();

  if (isError) {
    return <p className="py-16 text-center text-sm text-bearish">Unable to load this instrument.</p>;
  }
  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading instrument…</p>;
  }
  if (!instrument) {
    return (
      <EmptyState
        title="Instrument not found"
        description={`No instrument is registered under the symbol ${symbol}.`}
      />
    );
  }

  const mySignals = (signals ?? []).filter((s) => s.instrument_id === instrument.id);
  const myRegimes = (regimes ?? []).filter((r) => r.instrument_id === instrument.id).slice(0, 6);
  const myPerf = (snapshots ?? []).filter((s) => s.instrument_id === instrument.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={CATEGORY_LABEL[instrument.category] ?? instrument.category}
        title={`${instrument.symbol} · ${instrument.display_name}`}
        {...(instrument.description ? { description: instrument.description } : {})}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge rating={instrument.risk_rating} />
            <ValidationBadge status={instrument.validation_status} />
            {instrument.is_demo ? <DemoBadge /> : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <PanelHeader title="Coverage" subtitle="Configuration and provenance" />
          <div className="px-4 py-2">
            <DataRow label="Last price" value={formatPrice(instrument.current_price)} />
            <DataRow
              label="Data freshness"
              value={
                <FreshnessBadge
                  timestamp={instrument.last_data_at}
                  {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})}
                />
              }
            />
            <DataRow label="Provider" value={instrument.provider} />
            <DataRow label="Data source" value={instrument.data_source ?? "—"} />
            <DataRow label="Market status" value={instrument.market_status} />
            <DataRow label="Default timeframe" value={instrument.timeframe_default} />
            <DataRow label="Asset class" value={instrument.asset_class} />
            <DataRow label="Minimum sample required" value={instrument.minimum_sample_required} />
            <DataRow label="Enabled" value={instrument.enabled ? "Yes" : "No"} />
            <DataRow label="Last updated" value={formatDate(instrument.updated_at)} />
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Market characteristics" subtitle="How the engine treats this instrument" />
          <div className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {instrument.market_characteristics ??
              "No characteristics recorded yet for this instrument."}
          </div>
          <div className="border-t border-border">
            <PanelHeader title="Regime history" subtitle="Most recent classifications" />
            {myRegimes.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                Awaiting market data — no regime classification recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {myRegimes.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                    <span className="text-muted-foreground">{r.timeframe}</span>
                    <span className="flex items-center gap-3">
                      <RegimeBadge regime={r.regime} />
                      <span className="numeric text-muted-foreground">
                        {formatPct(r.confidence_score)}
                      </span>
                      <span className="text-muted-foreground">{relativeAge(r.detected_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Signal record"
          subtitle="Every published output for this instrument, live and closed"
        />
        <SignalMatrix signals={mySignals} />
      </Panel>

      <Panel>
        <PanelHeader title="Measured performance" subtitle="Backend-computed snapshots only" />
        {myPerf.length === 0 ? (
          <EmptyState
            title="No performance data yet"
            description="Snapshots appear once enough signals on this instrument have closed."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Strategy", "TF", "Mode", "Trades", "Win rate", "Profit factor", "Avg R:R", "Reliability"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {myPerf.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5">
                      {s.strategy?.name ?? "All strategies"}
                      {s.is_demo ? (
                        <span className="ml-2">
                          <DemoBadge />
                        </span>
                      ) : null}
                    </td>
                    <td className="numeric px-3 py-2.5 text-muted-foreground">{s.timeframe ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.mode}</td>
                    <td className="numeric px-3 py-2.5">{s.total_trades}</td>
                    <td className="numeric px-3 py-2.5">{formatPct(s.win_rate)}</td>
                    <td className="numeric px-3 py-2.5">{formatNum(s.profit_factor)}</td>
                    <td className="numeric px-3 py-2.5">{formatNum(s.avg_rr_ratio)}</td>
                    <td className="px-3 py-2.5">
                      {isSampleReliable(s.total_trades) ? (
                        <span className="text-bullish">Reliable</span>
                      ) : (
                        <span className="text-caution">n={s.total_trades}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border px-4 py-2.5">
              <SampleGuard totalTrades={Math.min(...myPerf.map((s) => s.total_trades))} />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
