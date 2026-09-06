import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { SignalMatrix } from "@/components/cossa/SignalMatrix";
import { useLiveSignals, useSignalHistory, useSignalRealtime } from "@/hooks/useCossa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signals")({
  head: () => ({
    meta: [
      { title: "Signals — Cossa Signals" },
      { name: "description", content: "Live and historical Cossa Signals outputs with entry, stop, targets, confidence, regime and validation status." },
      { property: "og:title", content: "Signals — Cossa Signals" },
      { property: "og:description", content: "Live and historical evidence-based signals with full risk context." },
    ],
  }),
  component: SignalsPage,
});

function SignalsPage() {
  return (
    <RequireAuth>
      <SignalsContent />
    </RequireAuth>
  );
}

function SignalsContent() {
  useSignalRealtime();
  const [tab, setTab] = useState<"live" | "history">("live");
  const live = useLiveSignals(200);
  const history = useSignalHistory(200);

  const active = tab === "live" ? live : history;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Signal Feed"
        title="Signals & history"
        description="Every published output — including WAIT and NO TRADE — with the full context required before any decision."
      />

      <div className="flex gap-1 rounded-lg border border-border bg-panel p-1">
        {(
          [
            ["live", `Live (${(live.data ?? []).length})`],
            ["history", `History (${(history.data ?? []).length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors sm:flex-none sm:px-5",
              tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel>
        <PanelHeader
          title={tab === "live" ? "Open & pending outputs" : "Closed record"}
          subtitle={
            tab === "live"
              ? "Real-time — updates as the engine publishes"
              : "Historical outcomes, wins and losses alike — nothing hidden"
          }
        />
        {active.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <SignalMatrix signals={active.data ?? []} />
        )}
      </Panel>
    </div>
  );
}
