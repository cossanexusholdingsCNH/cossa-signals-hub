import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EvidenceMatrix } from "@/components/cossa/EvidenceMatrix";
import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { SignalMatrix } from "@/components/cossa/SignalMatrix";
import { useSignalHistory } from "@/hooks/useCossa";
import { useOpportunityScanner } from "@/hooks/useOpportunityScanner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signals")({
  head: () => ({
    meta: [
      { title: "Signals — Cossa Signals" },
      { name: "description", content: "Current immutable Cossa evidence and historical signal records with entry, stop, targets, confidence, regime and qualification status." },
      { property: "og:title", content: "Signals — Cossa Signals" },
      { property: "og:description", content: "Current evidence-based signals with full risk context." },
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
  const [tab, setTab] = useState<"live" | "history">("live");
  const scanner = useOpportunityScanner(15_000);
  const history = useSignalHistory(200);
  const current = scanner.data?.opportunities ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Signal Feed"
        title="Signals & history"
        description="Current outputs come from immutable signal evidence — including BUY, SELL, WAIT and NO TRADE — with the full context required before any decision."
      />

      <div className="flex gap-1 rounded-lg border border-border bg-panel p-1">
        {(
          [
            ["live", `Current (${current.length})`],
            ["history", `Legacy history (${(history.data ?? []).length})`],
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
          title={tab === "live" ? "Current evidence outputs" : "Closed legacy signal record"}
          subtitle={
            tab === "live"
              ? "Same immutable evidence and qualification state used by Opportunity Scanner"
              : "Historical rows from the earlier signals lifecycle; retained for audit continuity"
          }
        />
        {tab === "live" ? (
          scanner.isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading current evidence…</p>
          ) : scanner.isError ? (
            <p className="px-4 py-10 text-center text-sm text-destructive">
              {scanner.error instanceof Error ? scanner.error.message : "Unable to load current evidence"}
            </p>
          ) : (
            <EvidenceMatrix opportunities={current} />
          )
        ) : history.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading history…</p>
        ) : (
          <SignalMatrix signals={history.data ?? []} />
        )}
      </Panel>
    </div>
  );
}
