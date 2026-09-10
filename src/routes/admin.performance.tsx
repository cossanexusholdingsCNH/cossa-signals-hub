import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { DemoBadge } from "@/components/cossa/badges";
import { usePerformanceSnapshots } from "@/hooks/useCossa";
import { formatDate, formatNum, formatPct, isSampleReliable } from "@/lib/cossa";

export const Route = createFileRoute("/admin/performance")({
  head: () => ({
    meta: [
      { title: "Performance Administration — Cossa Signals" },
      {
        name: "description",
        content: "Staff performance view with demo and live snapshots kept strictly separate.",
      },
      { property: "og:title", content: "Performance Administration — Cossa Signals" },
      { property: "og:description", content: "Demo and verified performance, never mixed." },
    ],
  }),
  component: AdminPerformance,
});

function AdminPerformance() {
  const { data: snapshots, isLoading, isError } = usePerformanceSnapshots();

  const all = snapshots ?? [];
  const live = all.filter((s) => !s.is_demo);
  const demo = all.filter((s) => s.is_demo);
  const verified = live.filter((s) => s.mode === "live_verified" && isSampleReliable(s.total_trades));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Performance records"
        description="Snapshots are computed by the backend. Demo snapshots are listed separately and must never be presented as trading results."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total snapshots" value={all.length} />
        <StatCard label="Live snapshots" value={live.length} tone="gold" />
        <StatCard label="Demo snapshots" value={demo.length} tone="caution" />
        <StatCard
          label="Verified & reliable"
          value={verified.length}
          tone={verified.length > 0 ? "bullish" : "caution"}
          hint="live_verified with 30+ trades"
        />
      </div>

      {isError ? (
        <p className="py-10 text-center text-sm text-bearish">Unable to load performance records.</p>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading records…</p>
      ) : (
        <>
          <SnapshotPanel
            title="Live / verified performance"
            subtitle="Real engine output only"
            rows={live}
            empty="No live performance yet — awaiting the signal engine to close real trades."
          />
          <SnapshotPanel
            title="Demo performance"
            subtitle="Seeded records for interface verification only"
            rows={demo}
            empty="No demo snapshots present."
          />
        </>
      )}
    </div>
  );
}

function SnapshotPanel({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: ReturnType<typeof usePerformanceSnapshots>["data"] extends (infer T)[] | undefined ? T[] : never;
  empty: string;
}) {
  return (
    <Panel>
      <PanelHeader title={title} subtitle={subtitle} />
      {rows.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                {["Instrument", "Strategy", "TF", "Mode", "Trades", "Win rate", "Profit factor", "Return", "Reliability", "Calculated"].map(
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
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="numeric font-semibold">{s.instrument?.symbol ?? "All"}</span>
                    {s.is_demo ? (
                      <span className="ml-2">
                        <DemoBadge />
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-muted-foreground">
                    {s.strategy?.name ?? "All strategies"}
                  </td>
                  <td className="numeric px-3 py-2.5 text-muted-foreground">{s.timeframe ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.mode}</td>
                  <td className="numeric px-3 py-2.5">{s.total_trades}</td>
                  <td className="numeric px-3 py-2.5">{formatPct(s.win_rate)}</td>
                  <td className="numeric px-3 py-2.5">{formatNum(s.profit_factor)}</td>
                  <td className="numeric px-3 py-2.5">{formatPct(s.total_return_pct)}</td>
                  <td className="px-3 py-2.5">
                    {isSampleReliable(s.total_trades) ? (
                      <span className="text-bullish">Reliable</span>
                    ) : (
                      <span className="text-caution">n={s.total_trades}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {formatDate(s.calculated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
