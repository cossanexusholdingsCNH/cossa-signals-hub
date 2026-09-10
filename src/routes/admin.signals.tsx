import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { SignalMatrix } from "@/components/cossa/SignalMatrix";
import { useAllSignals } from "@/hooks/useCossa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/signals")({
  head: () => ({
    meta: [
      { title: "Signal Administration — Cossa Signals" },
      {
        name: "description",
        content: "Staff view of every published signal, separated into live and demo records.",
      },
      { property: "og:title", content: "Signal Administration — Cossa Signals" },
      { property: "og:description", content: "Every published signal, live and demo, in one staff view." },
    ],
  }),
  component: AdminSignals,
});

function AdminSignals() {
  const { data: signals, isLoading, isError } = useAllSignals(300);
  const [view, setView] = useState<"live" | "demo">("live");

  const all = signals ?? [];
  const live = all.filter((s) => !s.is_demo);
  const demo = all.filter((s) => s.is_demo);
  const rows = view === "live" ? live : demo;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Signals"
        description="Complete signal record. Demo rows are kept strictly separate and are never counted as live output."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live records" value={live.length} tone="gold" />
        <StatCard label="Demo records" value={demo.length} tone="caution" />
        <StatCard
          label="Open live signals"
          value={live.filter((s) => ["pending", "active"].includes(s.status)).length}
        />
        <StatCard
          label="Wait / no-trade"
          value={all.filter((s) => s.direction === "wait" || s.direction === "no_trade").length}
        />
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-panel p-1">
        {(
          [
            ["live", `Live (${live.length})`],
            ["demo", `Demo (${demo.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors",
              view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel>
        <PanelHeader
          title={view === "live" ? "Live signal record" : "Demo signal record"}
          subtitle={
            view === "live"
              ? "Written by the Cossa Signals engine"
              : "Seeded records for interface verification only — never presented as live output"
          }
        />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load signals.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading signals…</p>
        ) : (
          <SignalMatrix signals={rows} />
        )}
      </Panel>
    </div>
  );
}
