import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, CircleAlert } from "lucide-react";

import { RequireAuth } from "@/components/layout/RequireAuth";
import {
  PageHeader,
  Panel,
  PanelHeader,
  DataRow,
  EmptyState,
  SampleGuard,
} from "@/components/cossa/primitives";
import {
  ConfidenceMeter,
  DemoBadge,
  DirectionBadge,
  FreshnessBadge,
  ModeBadge,
  RegimeBadge,
  RiskBadge,
  StatusBadge,
  ValidationBadge,
} from "@/components/cossa/badges";
import {
  useSignal,
  useSignalIndicators,
  useSignalVotes,
  useRiskCheck,
  useSignalRealtime,
} from "@/hooks/useCossa";
import {
  formatDate,
  formatNum,
  formatPct,
  formatPrice,
  qualityBand,
  relativeAge,
  CATEGORY_LABEL,
} from "@/lib/cossa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signals/$id")({
  head: () => ({
    meta: [
      { title: "Signal detail — Cossa Signals" },
      { name: "description", content: "Full signal intelligence: entry, risk, confidence decomposition, council votes, risk gate and lifecycle." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignalDetailPage,
});

function SignalDetailPage() {
  return (
    <RequireAuth>
      <SignalDetailContent />
    </RequireAuth>
  );
}

function SignalDetailContent() {
  const { id } = Route.useParams();
  useSignalRealtime();
  const { data: signal, isLoading } = useSignal(id);
  const { data: indicators } = useSignalIndicators(id);
  const { data: votes } = useSignalVotes(id);
  const { data: riskCheck } = useRiskCheck(id);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading signal…</p>;
  }
  if (!signal) {
    return (
      <EmptyState
        title="Signal not found"
        description="It may have expired from your view, or the link is incorrect."
      />
    );
  }

  const inst = signal.instrument;
  const band = qualityBand(signal.signal_quality_score);
  const bandTone = {
    bullish: "text-bullish",
    caution: "text-caution",
    bearish: "text-bearish",
    neutral: "text-muted-foreground",
  }[band.tone];
  const breakdown = signal.confidence_breakdown;
  const isNoTrade = signal.direction === "no_trade" || signal.direction === "wait";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Signal · ${inst?.symbol ?? ""} · ${signal.timeframe}`}
        title={`${inst?.display_name ?? "Instrument"} — ${signal.strategy_name ?? "Strategy output"}`}
        description={signal.signal_reason ?? "Signal context is provided by the Cossa Signals engine."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {signal.is_demo ? <DemoBadge /> : null}
            <DirectionBadge direction={signal.direction} size="lg" />
          </div>
        }
      />

      {/* Trade plan */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel gold className="lg:col-span-2">
          <PanelHeader
            title="Trade plan"
            subtitle="Levels as calculated by the engine — never adjusted in the browser"
            action={<StatusBadge status={signal.status} />}
          />
          <div className="grid grid-cols-2 gap-x-6 px-4 py-2 sm:grid-cols-3">
            <DataRow label="Current price" value={formatPrice(inst?.current_price ?? signal.current_price)} />
            <DataRow label="Entry" value={formatPrice(signal.entry_price)} />
            <DataRow
              label="Entry zone"
              value={
                signal.entry_zone_low != null && signal.entry_zone_high != null
                  ? `${formatPrice(signal.entry_zone_low)} – ${formatPrice(signal.entry_zone_high)}`
                  : "—"
              }
            />
            <DataRow label="Stop loss" value={<span className="text-bearish">{formatPrice(signal.stop_loss)}</span>} />
            <DataRow label="Target 1" value={<span className="text-bullish">{formatPrice(signal.take_profit_1)}</span>} />
            <DataRow label="Target 2" value={<span className="text-bullish">{formatPrice(signal.take_profit_2)}</span>} />
            <DataRow label="Target 3" value={<span className="text-bullish">{formatPrice(signal.take_profit_3)}</span>} />
            <DataRow label="Risk : Reward" value={signal.risk_reward_ratio ? `${formatNum(signal.risk_reward_ratio)} : 1` : "—"} />
            <DataRow
              label="Return"
              value={
                <span className={cn((signal.realized_return_pct ?? signal.unrealized_return_pct ?? 0) >= 0 ? "text-bullish" : "text-bearish")}>
                  {formatPct(signal.realized_return_pct ?? signal.unrealized_return_pct)}
                </span>
              }
            />
          </div>
          {signal.invalidation_reason ? (
            <p className="border-t border-border px-4 py-3 text-xs text-bearish">
              Invalidated: {signal.invalidation_reason}
            </p>
          ) : null}
          {signal.failure_risk ? (
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-caution">Why this could fail: </span>
              {signal.failure_risk}
            </p>
          ) : null}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Confidence" subtitle="Engine-scored, decomposed" />
            <div className="space-y-3 px-4 py-3">
              <ConfidenceMeter score={signal.confidence_score} grade={signal.confidence_grade} />
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow">Quality score</span>
                  <span className={cn("numeric text-lg font-semibold", bandTone)}>
                    {signal.signal_quality_score ?? "—"}
                    <span className="text-xs text-muted-foreground"> / 100</span>
                  </span>
                </div>
                <p className={cn("mt-0.5 text-[11px]", bandTone)}>{band.label}</p>
              </div>
              {breakdown ? (
                <div className="space-y-1.5 border-t border-border/60 pt-2.5">
                  {(
                    [
                      ["Technical indicators", breakdown.technical_indicators],
                      ["Market regime", breakdown.market_regime],
                      ["Strategy strength", breakdown.historical_strategy_strength],
                      ["ML probability", breakdown.ml_probability],
                      ["Risk adjustment", breakdown.risk_adjustment],
                    ] as const
                  ).map(([label, v]) =>
                    v != null ? (
                      <div key={label} className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="numeric">{formatNum(v, 0)}</span>
                      </div>
                    ) : null,
                  )}
                </div>
              ) : null}
              <SampleGuard totalTrades={signal.historical_sample_size} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Context" />
            <div className="flex flex-wrap gap-2 px-4 py-3">
              <RegimeBadge regime={signal.market_regime} />
              <ValidationBadge status={signal.validation_status} />
              <RiskBadge rating={signal.risk_rating} />
              <ModeBadge mode={signal.mode} />
              <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] tracking-wider text-muted-foreground uppercase">
                {CATEGORY_LABEL[inst?.category ?? ""] ?? inst?.category}
              </span>
            </div>
            <div className="border-t border-border px-4 py-2">
              <DataRow label="Opened" value={`${relativeAge(signal.opened_at)} · ${formatDate(signal.opened_at)}`} />
              <DataRow label="Expires" value={formatDate(signal.expires_at)} />
              <DataRow label="Closed" value={formatDate(signal.closed_at)} />
              <DataRow label="Sample size" value={signal.historical_sample_size ?? "—"} />
              <DataRow label="Data as of" value={formatDate(signal.data_timestamp)} />
              <DataRow
                label="Feed"
                value={<FreshnessBadge timestamp={inst?.last_data_at} />}
              />
            </div>
          </Panel>
        </div>
      </div>

      {/* NO-TRADE intelligence */}
      {isNoTrade && signal.no_trade_reasons.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Why no trade"
            subtitle="Rejecting weak setups is a core behaviour of the engine"
          />
          <ul className="space-y-2 px-4 py-3">
            {signal.no_trade_reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-caution" />
                {reason}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Indicators */}
        <Panel>
          <PanelHeader title="Supporting indicators" subtitle="Weighted evidence behind this output" />
          {(indicators ?? []).length === 0 ? (
            <EmptyState title="No indicator breakdown published" description="The engine has not attached indicator evidence to this signal." />
          ) : (
            <ul className="divide-y divide-border/60">
              {(indicators ?? []).map((ind) => (
                <li key={ind.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{ind.indicator_name}</span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold tracking-wider uppercase",
                        ind.direction === "bullish"
                          ? "text-bullish"
                          : ind.direction === "bearish"
                            ? "text-bearish"
                            : "text-muted-foreground",
                      )}
                    >
                      {ind.direction}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {ind.indicator_display ?? (ind.indicator_value != null ? formatNum(ind.indicator_value) : "—")}
                    {ind.interpretation ? ` — ${ind.interpretation}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Council */}
        <Panel>
          <PanelHeader title="AI Signal Council" subtitle="Agent votes that formed the consensus" />
          {(votes ?? []).length === 0 ? (
            <EmptyState title="No council votes recorded" description="Council deliberation is attached when the engine publishes it." />
          ) : (
            <ul className="divide-y divide-border/60">
              {(votes ?? []).map((v) => (
                <li key={v.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{v.agent_name}</span>
                    <span className="flex items-center gap-2">
                      {v.confidence != null ? (
                        <span className="numeric text-[11px] text-muted-foreground">{formatNum(v.confidence, 0)}%</span>
                      ) : null}
                      <span
                        className={cn(
                          "text-[10px] font-semibold tracking-wider uppercase",
                          v.vote === "buy"
                            ? "text-bullish"
                            : v.vote === "sell"
                              ? "text-bearish"
                              : v.vote === "reject"
                                ? "text-caution"
                                : "text-muted-foreground",
                        )}
                      >
                        {v.vote}
                      </span>
                    </span>
                  </div>
                  {v.reason ? <p className="mt-0.5 text-[11px] text-muted-foreground">{v.reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Risk gate */}
        <Panel>
          <PanelHeader
            title="Risk Gate"
            subtitle="Even high-confidence signals can be rejected here"
            action={
              riskCheck ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase",
                    riskCheck.overall_status === "approved"
                      ? "border-bullish/40 bg-bullish/10 text-bullish"
                      : riskCheck.overall_status === "caution"
                        ? "border-caution/40 bg-caution/10 text-caution"
                        : "border-bearish/40 bg-bearish/10 text-bearish",
                  )}
                >
                  <ShieldCheck className="size-3" />
                  {riskCheck.overall_status}
                </span>
              ) : undefined
            }
          />
          {!riskCheck ? (
            <EmptyState title="No risk check recorded" description="Risk Gate output is attached when the engine publishes it." />
          ) : (
            <ul className="divide-y divide-border/60">
              {riskCheck.checks.map((c, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2 text-xs">
                  <span>{c.name}</span>
                  <span
                    className={cn(
                      "font-semibold tracking-wider uppercase",
                      c.status === "pass" ? "text-bullish" : c.status === "warn" ? "text-caution" : "text-bearish",
                    )}
                  >
                    {c.status}
                  </span>
                </li>
              ))}
              {riskCheck.notes ? (
                <li className="px-4 py-2.5 text-[11px] text-muted-foreground">{riskCheck.notes}</li>
              ) : null}
            </ul>
          )}
        </Panel>
      </div>

      {/* AI explanation */}
      <Panel>
        <PanelHeader
          title="AI explanation"
          subtitle="Generated by the Cossa Signals engine — never in the browser"
          action={<Sparkles className="size-4 text-primary" />}
        />
        {signal.ai_summary ? (
          <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
            <AiBlock title="Summary" body={signal.ai_summary} />
            <AiBlock title="Market context" body={signal.ai_market_context} />
            <AiBlock title="Bullish evidence" body={signal.ai_bullish_evidence} tone="text-bullish" />
            <AiBlock title="Bearish evidence" body={signal.ai_bearish_evidence} tone="text-bearish" />
            <AiBlock title="Uncertainty" body={signal.ai_uncertainty} />
            <AiBlock title="Risk explanation" body={signal.ai_risk_explanation} tone="text-caution" />
            {signal.ai_recommendation ? (
              <div className="md:col-span-2">
                <AiBlock title="Recommendation" body={signal.ai_recommendation} tone="text-primary" />
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="AI explanation pending"
            description="The explanation layer publishes alongside the signal once the engine's AI pass completes."
          />
        )}
      </Panel>

      {/* Provenance */}
      <Panel>
        <PanelHeader title="Data provenance" subtitle="Traceability for every number on this page" />
        <div className="grid grid-cols-2 gap-x-6 px-4 py-2 sm:grid-cols-3">
          <DataRow label="Source" value={signal.source ?? "—"} />
          <DataRow label="Source version" value={signal.source_version ?? "—"} />
          <DataRow label="Model version" value={signal.model_version ?? "—"} />
          <DataRow label="Strategy version" value={signal.strategy_version ?? "—"} />
          <DataRow label="Calculated at" value={formatDate(signal.calculated_at)} />
          <DataRow label="Instrument feed" value={inst?.provider ?? "—"} />
        </div>
        <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          <Link to="/signals" className="text-primary hover:underline">← Back to signals</Link>
        </p>
      </Panel>
    </div>
  );
}

function AiBlock({ title, body, tone }: { title: string; body: string | null; tone?: string }) {
  if (!body) return null;
  return (
    <div>
      <p className={cn("eyebrow", tone)}>{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
