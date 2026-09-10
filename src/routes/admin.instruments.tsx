import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { InstrumentTable } from "@/components/cossa/InstrumentTable";
import { useInstruments, usePlatformControls } from "@/hooks/useCossa";

export const Route = createFileRoute("/admin/instruments")({
  head: () => ({
    meta: [
      { title: "Instrument Administration — Cossa Signals" },
      {
        name: "description",
        content: "Staff view of instrument coverage, validation status, providers and demo classification.",
      },
      { property: "og:title", content: "Instrument Administration — Cossa Signals" },
      { property: "og:description", content: "Coverage, providers and validation status." },
    ],
  }),
  component: AdminInstruments,
});

function AdminInstruments() {
  const { data: instruments, isLoading, isError } = useInstruments();
  const { data: controls } = usePlatformControls();

  const all = instruments ?? [];
  const demo = all.filter((i) => i.is_demo);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Instruments"
        description="Instrument configuration is owned by the backend. This view confirms what the engine has registered and how it is classified."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={all.length} tone="gold" />
        <StatCard label="Enabled" value={all.filter((i) => i.enabled).length} />
        <StatCard label="Demo classified" value={demo.length} tone="caution" />
        <StatCard
          label="Live verified"
          value={all.filter((i) => i.validation_status === "live_verified").length}
        />
      </div>

      {demo.length === all.length && all.length > 0 ? (
        <Panel>
          <p className="px-4 py-3 text-xs text-caution">
            All registered instruments are demo classified — awaiting live backend connection.
          </p>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Registered instruments" subtitle="Read-only" />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load instruments.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading instruments…</p>
        ) : (
          <InstrumentTable
            instruments={all}
            {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})}
          />
        )}
      </Panel>
    </div>
  );
}
