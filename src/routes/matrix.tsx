import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { SignalMatrix } from "@/components/cossa/SignalMatrix";
import { useLiveSignals, useStrategies, useSignalRealtime } from "@/hooks/useCossa";
import { CATEGORY_LABEL, TIMEFRAMES, type Direction, type ValidationStatus } from "@/lib/cossa";
import type { SignalRow } from "@/hooks/useCossa";

export const Route = createFileRoute("/matrix")({
  head: () => ({
    meta: [
      { title: "Smart Signal Matrix — Cossa Signals" },
      { name: "description", content: "The full Cossa Signals matrix: instrument, direction, entry, stop, targets, confidence, regime, validation and data freshness in one view." },
      { property: "og:title", content: "Smart Signal Matrix — Cossa Signals" },
      { property: "og:description", content: "Every qualified signal with full context: entry, risk, regime, validation and evidence." },
    ],
  }),
  component: MatrixPage,
});

type SortKey = "confidence" | "newest" | "rr";

function MatrixPage() {
  return (
    <RequireAuth>
      <MatrixContent />
    </RequireAuth>
  );
}

function MatrixContent() {
  useSignalRealtime();
  const { data: signals, isLoading } = useLiveSignals(300);
  const { data: strategies } = useStrategies();

  const [category, setCategory] = useState("all");
  const [direction, setDirection] = useState("all");
  const [timeframe, setTimeframe] = useState("all");
  const [strategy, setStrategy] = useState("all");
  const [validation, setValidation] = useState("all");
  const [minConfidence, setMinConfidence] = useState(0);
  const [sort, setSort] = useState<SortKey>("newest");

  const categories = useMemo(() => {
    const set = new Set<string>();
    (signals ?? []).forEach((s) => s.instrument?.category && set.add(s.instrument.category));
    return [...set].sort();
  }, [signals]);

  const filtered = useMemo(() => {
    let rows: SignalRow[] = [...(signals ?? [])];
    if (category !== "all") rows = rows.filter((s) => s.instrument?.category === category);
    if (direction !== "all") rows = rows.filter((s) => s.direction === (direction as Direction));
    if (timeframe !== "all") rows = rows.filter((s) => s.timeframe === timeframe);
    if (strategy !== "all") rows = rows.filter((s) => s.strategy_name === strategy);
    if (validation !== "all")
      rows = rows.filter((s) => s.validation_status === (validation as ValidationStatus));
    if (minConfidence > 0) rows = rows.filter((s) => (s.confidence_score ?? 0) >= minConfidence);
    if (sort === "confidence")
      rows.sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0));
    else if (sort === "rr")
      rows.sort((a, b) => (b.risk_reward_ratio ?? 0) - (a.risk_reward_ratio ?? 0));
    else rows.sort((a, b) => +new Date(b.opened_at) - +new Date(a.opened_at));
    return rows;
  }, [signals, category, direction, timeframe, strategy, validation, minConfidence, sort]);

  const strategyNames = useMemo(
    () => [...new Set((signals ?? []).map((s) => s.strategy_name).filter(Boolean))] as string[],
    [signals],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Smart Signal Matrix"
        title="Every instrument. Full context."
        description="No signal appears without entry, stop, targets, confidence, regime, validation status and data freshness. WAIT and NO TRADE are first-class outputs."
      />

      <Panel>
        <PanelHeader
          title="Filters"
          subtitle={`${filtered.length} of ${(signals ?? []).length} live outputs shown`}
        />
        <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 lg:grid-cols-7">
          <FilterSelect label="Category" value={category} onChange={setCategory}
            options={[["all", "All categories"], ...categories.map((c) => [c, CATEGORY_LABEL[c] ?? c] as const)]} />
          <FilterSelect label="Direction" value={direction} onChange={setDirection}
            options={[["all", "All"], ["buy", "Buy"], ["sell", "Sell"], ["wait", "Wait"], ["neutral", "Neutral"], ["no_trade", "No trade"]]} />
          <FilterSelect label="Timeframe" value={timeframe} onChange={setTimeframe}
            options={[["all", "All"], ...TIMEFRAMES.map((t) => [t, t] as const)]} />
          <FilterSelect label="Strategy" value={strategy} onChange={setStrategy}
            options={[["all", "All strategies"], ...strategyNames.map((s) => [s, s] as const)]} />
          <FilterSelect label="Validation" value={validation} onChange={setValidation}
            options={[["all", "All"], ["live_verified", "Live verified"], ["paper_validated", "Paper validated"], ["paper_trading", "Paper trading"], ["backtested", "Backtested"], ["experimental", "Experimental"]]} />
          <FilterSelect label="Min confidence" value={String(minConfidence)} onChange={(v) => setMinConfidence(Number(v))}
            options={[["0", "Any"], ["50", "50%+"], ["60", "60%+"], ["70", "70%+"], ["80", "80%+"]]} />
          <FilterSelect label="Sort by" value={sort} onChange={(v) => setSort(v as SortKey)}
            options={[["newest", "Newest"], ["confidence", "Confidence"], ["rr", "Best R:R"]]} />
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          {(strategies ?? []).length} strateg{(strategies ?? []).length === 1 ? "y" : "ies"} loaded · signals update in real time
        </p>
      </Panel>

      <Panel>
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading matrix…</p>
        ) : (
          <SignalMatrix signals={filtered} />
        )}
      </Panel>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-border-gold"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
