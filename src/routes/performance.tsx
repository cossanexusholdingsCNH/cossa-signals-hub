import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Panel, PanelHeader, StatCard, EmptyState, SampleGuard } from "@/components/cossa/primitives";
import { ValidationBadge, DemoBadge } from "@/components/cossa/badges";
import { usePerformanceSnapshots } from "@/hooks/useCossa";
import { formatDate, formatNum, formatPct, isSampleReliable } from "@/lib/cossa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "Performance Evidence — Cossa Signals" },
      { name: "description", content: "Transparent research, backtest, paper and live-verified performance evidence for Cossa Signals, with mode and sample-size context." },
      { property: "og:title", content: "Performance Evidence — Cossa Signals" },
      { property: "og:description", content: "Mode-aware, statistically guarded Cossa Signals performance evidence." },
    ],
  }),
  component: PerformancePage,
});

function PerformancePage() {
  return (
    <RequireAuth>
      <PerformanceContent />
    </RequireAuth>
  );
}

function PerformanceContent() {
  const { data: snapshots, isLoading } = usePerformanceSnapshots();
  const [mode, setMode] = useState("all");

  const modes = useMemo(
    () => [...new Set((snapshots ?? []).map((s) => s.mode))].sort(),
    [snapshots],
  );
  const rows = useMemo(
    () => (snapshots ?? []).filter((s) => mode === "all" || s.mode === mode),
    [snapshots, mode],
  );
  const reliable = rows.filter((s) => isSampleReliable(s.total_trades));
  const allDemo = rows.length > 0 && rows.every((s) => s.is_demo);
  const hasLiveVerified = rows.some((s) => s.mode === "live_verified" && !s.is_demo);
  const newestCalculatedAt = useMemo(() => {
    const timestamps = rows
      .map((s) => new Date(s.calculated_at).getTime())
      .filter((value) => Number.isFinite(value));
    return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
  }, [rows]);

  const agg = useMemo(() => {
    if (reliable.length === 0) return null;
    const trades = reliable.reduce((a, s) => a + s.total_trades, 0);
    const wins = reliable.reduce((a, s) => a + s.wins, 0);
    const winRates = reliable.map((s) => s.win_rate).filter((v): v is number => v != null);
    const avgWinRate =
      winRates.length > 0 ? winRates.reduce((a, b) => a + b, 0) / winRates.length : null;
    return { trades, wins, avgWinRate, segments: reliable.length };
  }, [reliable]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Evidence"
        title="Performance evidence"
        description="Research, backtest, paper and live-verified results are kept separate. Historical demo snapshots are never presented as current live-account performance."
      />

      {allDemo ? (
        <Panel>
          <div className="space-y-1 px-4 py-3">
            <p className="text-xs font-semibold text-caution">Historical demo evidence — not live performance</p>
            <p className="text-[11px] leading-5 text-muted-foreground">
              Every snapshot in the current view is marked demo. These figures are research/backtest/paper evidence and must not be read as current account returns, live execution results or a performance promise.
              {newestCalculatedAt ? ` Latest snapshot: ${formatDate(newestCalculatedAt)}.` : ""}
            </p>
          </div>
        </Panel>
      ) : !isLoading && rows.length > 0 && !hasLiveVerified ? (
        <Panel>
          <div className="px-4 py-3 text-[11px] leading-5 text-muted-foreground">
            This view contains no live-verified segment. Use mode and demo labels when interpreting every result.
          </div>
        </Panel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Evidence segments" value={rows.length} hint="Instrument × strategy × timeframe snapshots" />
        <StatCard label="Reliable samples" value={reliable.length} tone="gold" hint="30+ trades within the selected evidence mode" />
        <StatCard
          label="Snapshot trades (reliable)"
          value={agg?.trades ?? "—"}
          hint="Historical snapshot totals; not account trade count"
        />
        <StatCard
          label="Snapshot avg win rate"
          value={agg?.avgWinRate != null ? formatPct(agg.avgWinRate) : "—"}
          tone={agg?.avgWinRate != null && agg.avgWinRate >= 50 ? "bullish" : "default"}
          hint={agg ? "Mean of reliable evidence segments" : "Insufficient sample size yet"}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Evidence segments"
          subtitle="Mode-labelled snapshots, including small samples"
          action={
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-border-gold"
            >
              <option value="all">All modes</option>
              {modes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          }
        />
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading performance evidence…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No performance evidence yet"
            description="Evidence snapshots appear only when a research, backtest, paper or live-verified measurement has been recorded."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Instrument", "Strategy", "TF", "Mode", "Trades", "Win rate", "Avg win", "Avg loss", "Profit factor", "Avg R:R", "Max DD", "Return", "Sharpe", "Reliability", "Calculated"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const ok = isSampleReliable(s.total_trades);
                  return (
                    <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-card/60">
                      <td className="px-3 py-2.5">
                        <span className="numeric font-semibold">{s.instrument?.symbol ?? "All"}</span>
                        {s.is_demo ? <span className="ml-2"><DemoBadge /></span> : null}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-muted-foreground">{s.strategy?.name ?? "All strategies"}</td>
                      <td className="numeric px-3 py-2.5 text-muted-foreground">{s.timeframe ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{s.mode}</td>
                      <td className="numeric px-3 py-2.5">{s.total_trades}</td>
                      <td className={cn("numeric px-3 py-2.5", (s.win_rate ?? 0) >= 50 ? "text-bullish" : "")}>{formatPct(s.win_rate)}</td>
                      <td className="numeric px-3 py-2.5 text-bullish">{formatPct(s.average_win)}</td>
                      <td className="numeric px-3 py-2.5 text-bearish">{formatPct(s.average_loss)}</td>
                      <td className="numeric px-3 py-2.5">{formatNum(s.profit_factor)}</td>
                      <td className="numeric px-3 py-2.5">{formatNum(s.avg_rr_ratio)}</td>
                      <td className="numeric px-3 py-2.5 text-bearish">{formatPct(s.max_drawdown)}</td>
                      <td className={cn("numeric px-3 py-2.5", (s.total_return_pct ?? 0) >= 0 ? "text-bullish" : "text-bearish")}>{formatPct(s.total_return_pct)}</td>
                      <td className="numeric px-3 py-2.5">{formatNum(s.sharpe_ratio)}</td>
                      <td className="px-3 py-2.5">
                        {ok ? (
                          <span className="text-bullish">Reliable sample</span>
                        ) : (
                          <span className="text-caution">n={s.total_trades}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(s.calculated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {rows.some((s) => !isSampleReliable(s.total_trades)) ? (
        <Panel>
          <div className="px-4 py-3">
            <SampleGuard totalTrades={Math.min(...rows.map((s) => s.total_trades))} />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Segments below the 30-trade threshold are shown for transparency but excluded from headline evidence aggregates.
            </p>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Strategy validation" subtitle="How each strategy earned its current validation status" />
        <ul className="divide-y divide-border/60">
          {[
            ...new Map(
              rows
                .filter((s) => s.strategy)
                .map((s) => [s.strategy!.name, s.strategy!]),
            ).values(),
          ].map((st) => (
            <li key={st.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
              <div>
                <span className="font-medium">{st.name}</span>
                <span className="ml-2 text-muted-foreground">{st.strategy_family}</span>
              </div>
              <ValidationBadge status={st.validation_status} />
            </li>
          ))}
          {rows.every((s) => !s.strategy) ? (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">No strategy data yet.</li>
          ) : null}
        </ul>
      </Panel>
    </div>
  );
}
