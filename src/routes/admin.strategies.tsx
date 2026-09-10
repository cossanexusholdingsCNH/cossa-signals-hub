import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { ValidationBadge } from "@/components/cossa/badges";
import { useModels, useStrategies } from "@/hooks/useCossa";
import type { ValidationStatus } from "@/lib/cossa";

export const Route = createFileRoute("/admin/strategies")({
  head: () => ({
    meta: [
      { title: "Strategies & Models — Cossa Signals" },
      {
        name: "description",
        content: "Strategy registry and model registry: versions, validation status, features used and applicability.",
      },
      { property: "og:title", content: "Strategies & Models — Cossa Signals" },
      { property: "og:description", content: "Strategy and model registry with validation status." },
    ],
  }),
  component: AdminStrategies,
});

function AdminStrategies() {
  const { data: strategies, isLoading, isError } = useStrategies();
  const { data: models } = useModels();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Strategies & models"
        description="Every published signal names the strategy and model version that produced it. This registry is the reference for those claims."
      />

      <Panel>
        <PanelHeader title="Strategy registry" subtitle="Owned by the backend engine" />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load strategies.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading strategies…</p>
        ) : (strategies ?? []).length === 0 ? (
          <EmptyState title="No strategies registered" description="Awaiting the signal engine." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Strategy", "Family", "Version", "Instruments", "Timeframes", "Min trades", "Validation", "Enabled"].map(
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
                {(strategies ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{s.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{s.strategy_family}</td>
                    <td className="numeric px-3 py-2.5 text-muted-foreground">{s.version}</td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground">
                      {s.applicable_instruments.join(", ") || "—"}
                    </td>
                    <td className="numeric px-3 py-2.5 text-muted-foreground">
                      {s.applicable_timeframes.join(", ") || "—"}
                    </td>
                    <td className="numeric px-3 py-2.5">{s.minimum_trades}</td>
                    <td className="px-3 py-2.5">
                      <ValidationBadge status={s.validation_status} />
                    </td>
                    <td className="px-3 py-2.5">{s.enabled ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Model registry" subtitle="Machine-learning components and their status" />
        {(models ?? []).length === 0 ? (
          <EmptyState
            title="No models registered"
            description="Model records appear once the backend registers a trained model."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Model", "Type", "Version", "Training", "Test", "Features", "Validation", "Enabled"].map((h) => (
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
                {(models ?? []).map((m) => (
                  <tr key={m.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{m.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{m.model_type}</td>
                    <td className="numeric px-3 py-2.5 text-muted-foreground">{m.version}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{m.training_period ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{m.test_period ?? "—"}</td>
                    <td className="numeric px-3 py-2.5">{m.features_used.length}</td>
                    <td className="px-3 py-2.5">
                      <ValidationBadge status={m.validation_status as ValidationStatus} />
                    </td>
                    <td className="px-3 py-2.5">{m.enabled ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
