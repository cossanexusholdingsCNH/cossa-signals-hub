import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, ShieldCheck, Gauge, Database } from "lucide-react";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Panel, PanelHeader, StatCard, EmptyState } from "@/components/cossa/primitives";
import { RegimeBadge, FreshnessBadge, DirectionBadge } from "@/components/cossa/badges";
import { SignalMatrix } from "@/components/cossa/SignalMatrix";
import {
  useLiveSignals,
  useMarketRegimes,
  useDataHealth,
  usePlatformControls,
  useSignalRealtime,
} from "@/hooks/useCossa";
import { REGIME_LABEL, relativeAge } from "@/lib/cossa";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center — Cossa Signals" },
      { name: "description", content: "Live signal posture, market regimes and data health across the Cossa Signals intelligence platform." },
      { property: "og:title", content: "Command Center — Cossa Signals" },
      { property: "og:description", content: "Live signal posture, market regimes and data health." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  useSignalRealtime();
  const { data: signals, isLoading } = useLiveSignals(12);
  const { data: regimes } = useMarketRegimes();
  const { data: health } = useDataHealth();
  const { data: controls } = usePlatformControls();

  const live = signals ?? [];
  const actionable = live.filter((s) => s.direction === "buy" || s.direction === "sell");
  const waiting = live.filter((s) => s.direction === "wait" || s.direction === "no_trade");
  const staleFeeds = (health ?? []).filter((h) => h.status === "stale" || h.status === "offline");
  const latestRegimes = (regimes ?? []).slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cossa Signals · Command Center"
        title="Market posture at a glance"
        description="Live signals, regime detection and pipeline health — every number on this page is produced by the Cossa Signals engine, never by the browser."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Actionable signals" value={actionable.length} tone="gold" hint="BUY / SELL currently open" />
        <StatCard label="Wait / No-trade" value={waiting.length} tone="caution" hint="Rejection is a valid outcome" />
        <StatCard
          label="Signal delivery"
          value={controls?.signals_enabled ? "Enabled" : "Paused"}
          tone={controls?.signals_enabled ? "bullish" : "bearish"}
          hint="Global risk gate"
        />
        <StatCard
          label="Data feeds"
          value={staleFeeds.length === 0 ? "Healthy" : `${staleFeeds.length} degraded`}
          tone={staleFeeds.length === 0 ? "bullish" : "bearish"}
          hint="Stale or offline sources"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Live Smart Signal Matrix"
          subtitle="Newest qualified outputs across all covered instruments"
          action={
            <Link to="/matrix" className="text-xs font-medium text-primary hover:underline">
              Open full matrix →
            </Link>
          }
        />
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading signals…</p>
        ) : (
          <SignalMatrix signals={live.slice(0, 8)} />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Market regimes" subtitle="Latest regime detection per instrument" />
          {latestRegimes.length === 0 ? (
            <EmptyState title="No regimes detected yet" description="Regime intelligence appears as the engine classifies conditions." />
          ) : (
            <ul className="divide-y divide-border/60">
              {latestRegimes.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <span className="numeric text-sm font-semibold">{r.instrument?.symbol ?? "—"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{r.timeframe}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <RegimeBadge regime={r.regime} />
                    <span className="text-[11px] text-muted-foreground">{relativeAge(r.detected_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Data pipeline health" subtitle="Freshness of every market data source" />
          {(health ?? []).length === 0 ? (
            <EmptyState title="No feed data" description="Pipeline health appears once the data engine reports in." />
          ) : (
            <ul className="divide-y divide-border/60">
              {(health ?? []).slice(0, 10).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                  <span className="flex items-center gap-2">
                    <Database className="size-3.5 text-muted-foreground" />
                    <span className="numeric font-medium">{h.instrument?.symbol ?? h.provider}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {h.latency_ms != null ? (
                      <span className="numeric text-muted-foreground">{h.latency_ms} ms</span>
                    ) : null}
                    <FreshnessBadge timestamp={h.last_received_at} {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Current stance" subtitle="Directional posture across covered instruments" />
        {live.length === 0 ? (
          <EmptyState
            icon={<Radio className="size-5" />}
            title="The engine is monitoring — no qualified outputs yet"
            description="Cossa Signals prefers rejecting weak trades. Quiet periods are normal."
          />
        ) : (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {live.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5 text-xs">
                <span className="numeric font-medium">{s.instrument?.symbol}</span>
                <DirectionBadge direction={s.direction} />
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          Every output passes the Risk Gate before publication — high confidence alone is never enough.
          <Gauge className="ml-2 size-3.5 text-primary" />
          {Object.values(REGIME_LABEL).length > 0 ? "Regime-aware" : ""}
        </div>
      </Panel>
    </div>
  );
}
