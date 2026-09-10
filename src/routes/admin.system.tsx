import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { DemoBadge, FreshnessBadge } from "@/components/cossa/badges";
import {
  useDataHealth,
  useHeartbeats,
  useInstruments,
  usePlatformControls,
} from "@/hooks/useCossa";
import { formatDate, relativeAge } from "@/lib/cossa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/system")({
  head: () => ({
    meta: [
      { title: "System Health — Cossa Signals" },
      {
        name: "description",
        content: "Pipeline latency, feed freshness and service heartbeats for the Cossa Signals platform.",
      },
      { property: "og:title", content: "System Health — Cossa Signals" },
      { property: "og:description", content: "Feed freshness and service heartbeats." },
    ],
  }),
  component: AdminSystem,
});

const STATUS_TONE: Record<string, string> = {
  healthy: "text-bullish",
  delayed: "text-caution",
  stale: "text-caution",
  offline: "text-bearish",
};

function AdminSystem() {
  const { data: health, isLoading, isError } = useDataHealth();
  const { data: beats } = useHeartbeats();
  const { data: controls } = usePlatformControls();
  const { data: instruments } = useInstruments();

  const demoInstrumentIds = new Set((instruments ?? []).filter((i) => i.is_demo).map((i) => i.id));
  const isDemoFeed = (instrumentId: string | null) =>
    instrumentId != null && demoInstrumentIds.has(instrumentId);

  const feeds = health ?? [];
  const liveFeeds = feeds.filter((f) => !isDemoFeed(f.instrument_id));
  const degraded = liveFeeds.filter((f) => f.status === "stale" || f.status === "offline");
  const demoOnlyTelemetry = feeds.length > 0 && liveFeeds.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="System health"
        description="Honest operational telemetry. Demo rows are labelled and never counted as live provider health."
      />

      {demoOnlyTelemetry ? (
        <Panel>
          <p className="px-4 py-3 text-xs text-caution">
            Demo telemetry only — awaiting live backend connection. No production data provider is
            currently reporting in.
          </p>
        </Panel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Feeds tracked" value={feeds.length} />
        <StatCard label="Live feeds" value={liveFeeds.length} tone={liveFeeds.length ? "gold" : "caution"} />
        <StatCard
          label="Degraded live feeds"
          value={degraded.length}
          tone={degraded.length === 0 ? "bullish" : "bearish"}
        />
        <StatCard
          label="Stale threshold"
          value={`${controls?.stale_threshold_seconds ?? "—"}s`}
          hint="Beyond this, data is marked stale"
        />
      </div>

      <Panel>
        <PanelHeader title="Data feed health" subtitle="Per provider and instrument" />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to reach the data service.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading telemetry…</p>
        ) : feeds.length === 0 ? (
          <EmptyState
            title="Awaiting live backend connection"
            description="Feed health appears once the data pipeline reports in."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Provider", "Instrument", "Status", "Latency", "Last received", "Freshness"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feeds.map((f) => (
                  <tr key={f.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5">
                      {f.provider}
                      {isDemoFeed(f.instrument_id) ? (
                        <span className="ml-2">
                          <DemoBadge />
                        </span>
                      ) : null}
                    </td>
                    <td className="numeric px-3 py-2.5 text-muted-foreground">
                      {f.instrument?.symbol ?? "—"}
                    </td>
                    <td className={cn("px-3 py-2.5 font-medium", STATUS_TONE[f.status] ?? "")}>
                      {f.status}
                    </td>
                    <td className="numeric px-3 py-2.5 text-muted-foreground">
                      {f.latency_ms != null ? `${f.latency_ms} ms` : "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(f.last_received_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <FreshnessBadge
                        timestamp={f.last_received_at}
                        {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Service heartbeats"
          subtitle="Backend workers reporting in — a missing heartbeat means that stage is not running"
        />
        {(beats ?? []).length === 0 ? (
          <EmptyState
            title="Awaiting live backend connection"
            description="No backend service has reported a heartbeat yet, so the platform is not fully operational."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {(beats ?? []).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <span className="font-medium">{b.service_name}</span>
                <span className="flex flex-wrap items-center gap-3">
                  {b.message ? <span className="text-muted-foreground">{b.message}</span> : null}
                  <span className={cn("font-medium", STATUS_TONE[b.status] ?? "")}>{b.status}</span>
                  <span className="text-muted-foreground">
                    {b.last_heartbeat ? relativeAge(b.last_heartbeat) : "never"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
