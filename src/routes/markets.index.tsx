import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { InstrumentTable } from "@/components/cossa/InstrumentTable";
import { useInstruments, usePlatformControls } from "@/hooks/useCossa";
import { CATEGORY_LABEL } from "@/lib/cossa";

export const Route = createFileRoute("/markets/")({
  head: () => ({
    meta: [
      { title: "Markets — Cossa Signals" },
      {
        name: "description",
        content:
          "Every market covered by Cossa Signals: forex pairs, Deriv synthetic indices, commodities and indices with data provenance and validation status.",
      },
      { property: "og:title", content: "Markets — Cossa Signals" },
      { property: "og:description", content: "Instrument coverage, data freshness and validation status." },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  return (
    <RequireAuth>
      <MarketsContent />
    </RequireAuth>
  );
}

function MarketsContent() {
  const { data: instruments, isLoading, isError } = useInstruments();
  const { data: controls } = usePlatformControls();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const all = instruments ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (i) =>
        i.symbol.toLowerCase().includes(q) ||
        i.display_name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [instruments, query]);

  const byClass = useMemo(() => {
    const map = new Map<string, number>();
    (instruments ?? []).forEach((i) => map.set(i.asset_class, (map.get(i.asset_class) ?? 0) + 1));
    return map;
  }, [instruments]);

  const demoOnly =
    (instruments ?? []).length > 0 && (instruments ?? []).every((i) => i.is_demo);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Instrument library"
        title="Markets we cover"
        description="Coverage, data provenance and validation status for every instrument the engine monitors. Prices are written by the Cossa data pipeline — the browser never estimates them."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Instruments" value={(instruments ?? []).length} tone="gold" />
        <StatCard label="Forex pairs" value={byClass.get("forex") ?? 0} />
        <StatCard label="Synthetic indices" value={byClass.get("synthetic_index") ?? 0} />
        <StatCard
          label="Commodities & indices"
          value={(byClass.get("commodity") ?? 0) + (byClass.get("index") ?? 0)}
        />
      </div>

      {demoOnly ? (
        <Panel>
          <p className="px-4 py-3 text-xs text-caution">
            Demo coverage only — awaiting live backend connection. No live price feed is attached yet.
          </p>
        </Panel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          to="/markets/forex"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-border-gold hover:text-primary"
        >
          Forex intelligence →
        </Link>
        <Link
          to="/markets/synthetics"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-border-gold hover:text-primary"
        >
          Synthetic indices intelligence →
        </Link>
      </div>

      <Panel>
        <PanelHeader
          title="All instruments"
          subtitle={`${rows.length} shown`}
          action={
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol or name"
              className="w-48 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-border-gold"
            />
          }
        />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load instruments.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading markets…</p>
        ) : (
          <InstrumentTable
            instruments={rows}
            {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})}
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Categories" subtitle="How Cossa Signals groups coverage" />
        <ul className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...new Set((instruments ?? []).map((i) => i.category))].sort().map((c) => (
            <li key={c} className="text-xs text-muted-foreground">
              <span className="text-foreground">{CATEGORY_LABEL[c] ?? c}</span> ·{" "}
              {(instruments ?? []).filter((i) => i.category === c).length} instruments
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
