import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EvidenceMatrix } from "@/components/cossa/EvidenceMatrix";
import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useOpportunityScanner } from "@/hooks/useOpportunityScanner";

export const Route = createFileRoute("/matrix")({
  head: () => ({
    meta: [
      { title: "Smart Signal Matrix — Cossa Signals" },
      { name: "description", content: "The full current Cossa evidence matrix: instrument, decision, entry, stop, targets, confidence, regime, qualification and freshness in one view." },
      { property: "og:title", content: "Smart Signal Matrix — Cossa Signals" },
      { property: "og:description", content: "Every current evidence set with full risk and qualification context." },
    ],
  }),
  component: MatrixPage,
});

type SortKey = "priority" | "confidence" | "newest" | "rr";
type Qualification = "all" | "qualified" | "rejected";

function MatrixPage() {
  return (
    <RequireAuth>
      <MatrixContent />
    </RequireAuth>
  );
}

function MatrixContent() {
  const scanner = useOpportunityScanner(15_000);
  const opportunities = scanner.data?.opportunities ?? [];

  const [category, setCategory] = useState("all");
  const [direction, setDirection] = useState("all");
  const [timeframe, setTimeframe] = useState("all");
  const [qualification, setQualification] = useState<Qualification>("all");
  const [minConfidence, setMinConfidence] = useState(0);
  const [sort, setSort] = useState<SortKey>("priority");

  const categories = useMemo(
    () => [...new Set(opportunities.map((item) => item.category).filter(Boolean))].sort(),
    [opportunities],
  );
  const timeframes = useMemo(
    () => [...new Set(opportunities.map((item) => item.timeframe).filter(Boolean))].sort(),
    [opportunities],
  );

  const filtered = useMemo(() => {
    let rows = [...opportunities];
    if (category !== "all") rows = rows.filter((item) => item.category === category);
    if (direction !== "all") rows = rows.filter((item) => item.direction === direction);
    if (timeframe !== "all") rows = rows.filter((item) => item.timeframe === timeframe);
    if (qualification === "qualified") rows = rows.filter((item) => item.qualified);
    if (qualification === "rejected") rows = rows.filter((item) => !item.qualified);
    if (minConfidence > 0) rows = rows.filter((item) => item.confidenceScore >= minConfidence);

    if (sort === "confidence") rows.sort((a, b) => b.confidenceScore - a.confidenceScore);
    else if (sort === "rr") rows.sort((a, b) => (b.riskRewardRatio ?? 0) - (a.riskRewardRatio ?? 0));
    else if (sort === "newest") rows.sort((a, b) => +new Date(b.generatedAt) - +new Date(a.generatedAt));
    else rows.sort((a, b) => b.opportunityScore - a.opportunityScore);
    return rows;
  }, [opportunities, category, direction, timeframe, qualification, minConfidence, sort]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Smart Signal Matrix"
        title="Every instrument. Full context."
        description="Built from the same immutable evidence as Opportunity Scanner. BUY, SELL, WAIT and NO-TRADE remain visible with entry, stop, target, confidence, regime, qualification and freshness."
      />

      <Panel>
        <PanelHeader title="Filters" subtitle={`${filtered.length} of ${opportunities.length} current evidence sets shown`} />
        <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect label="Category" value={category} onChange={setCategory}
            options={[["all", "All categories"], ...categories.map((value) => [value, value.replaceAll("_", " ")] as const)]} />
          <FilterSelect label="Direction" value={direction} onChange={setDirection}
            options={[["all", "All"], ["buy", "Buy"], ["sell", "Sell"], ["wait", "Wait"], ["no_trade", "No trade"]]} />
          <FilterSelect label="Timeframe" value={timeframe} onChange={setTimeframe}
            options={[["all", "All"], ...timeframes.map((value) => [value, value] as const)]} />
          <FilterSelect label="Qualification" value={qualification} onChange={(value) => setQualification(value as Qualification)}
            options={[["all", "All"], ["qualified", "Qualified"], ["rejected", "Wait / rejected"]]} />
          <FilterSelect label="Min confidence" value={String(minConfidence)} onChange={(value) => setMinConfidence(Number(value))}
            options={[["0", "Any"], ["50", "50%+"], ["60", "60%+"], ["70", "70%+"], ["80", "80%+"]]} />
          <FilterSelect label="Sort by" value={sort} onChange={(value) => setSort(value as SortKey)}
            options={[["priority", "Priority"], ["newest", "Newest"], ["confidence", "Confidence"], ["rr", "Best R:R"]]} />
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          Immutable signal_evidence · refreshed every 15 seconds · qualification rules match Opportunity Scanner
        </p>
      </Panel>

      {scanner.isError ? (
        <div className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
          {scanner.error instanceof Error ? scanner.error.message : "Unable to load evidence matrix"}
        </div>
      ) : null}

      <Panel>
        {scanner.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading current evidence…</p>
        ) : (
          <EvidenceMatrix opportunities={filtered} />
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
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-border-gold"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}
