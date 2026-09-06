import { Link } from "@tanstack/react-router";

import {
  ConfidenceMeter,
  DemoBadge,
  DirectionBadge,
  FreshnessBadge,
  RegimeBadge,
  RiskBadge,
  StatusBadge,
  ValidationBadge,
} from "@/components/cossa/badges";
import { EmptyState } from "@/components/cossa/primitives";
import { CATEGORY_LABEL, formatNum, formatPrice, relativeAge } from "@/lib/cossa";
import type { SignalRow } from "@/hooks/useCossa";

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-middle">{children}</td>;
}

/** Mobile card view — the matrix must stay readable on a phone. */
function MatrixCard({ signal }: { signal: SignalRow }) {
  const inst = signal.instrument;
  return (
    <Link
      to="/signals/$id"
      params={{ id: signal.id }}
      className="panel block px-4 py-3 transition-colors hover:border-border-gold"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="numeric text-sm font-semibold">{inst?.symbol}</span>
            {signal.is_demo ? <DemoBadge /> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {inst?.display_name} · {CATEGORY_LABEL[inst?.category ?? ""] ?? inst?.category} ·{" "}
            {signal.timeframe}
          </p>
        </div>
        <DirectionBadge direction={signal.direction} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="eyebrow">Price</p>
          <p className="numeric mt-0.5">{formatPrice(inst?.current_price)}</p>
        </div>
        <div>
          <p className="eyebrow">Confidence</p>
          <div className="mt-0.5">
            <ConfidenceMeter score={signal.confidence_score} grade={signal.confidence_grade} />
          </div>
        </div>
        <div>
          <p className="eyebrow">Entry</p>
          <p className="numeric mt-0.5">{formatPrice(signal.entry_price)}</p>
        </div>
        <div>
          <p className="eyebrow">Stop / Target</p>
          <p className="numeric mt-0.5">
            {formatPrice(signal.stop_loss)} / {formatPrice(signal.take_profit_1)}
          </p>
        </div>
        <div>
          <p className="eyebrow">R:R</p>
          <p className="numeric mt-0.5">
            {signal.risk_reward_ratio ? `${formatNum(signal.risk_reward_ratio)} : 1` : "—"}
          </p>
        </div>
        <div>
          <p className="eyebrow">Regime</p>
          <div className="mt-0.5">
            <RegimeBadge regime={signal.market_regime} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5">
        <ValidationBadge status={signal.validation_status} />
        <RiskBadge rating={signal.risk_rating} />
        <StatusBadge status={signal.status} />
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{relativeAge(signal.opened_at)}</span>
          <FreshnessBadge timestamp={inst?.last_data_at} />
        </span>
      </div>
    </Link>
  );
}

export function SignalMatrix({ signals }: { signals: SignalRow[] }) {
  if (signals.length === 0) {
    return (
      <EmptyState
        title="No qualified signals right now."
        description="Cossa Signals is monitoring the market. Wait and no-trade outcomes are normal and expected."
      />
    );
  }

  return (
    <>
      {/* Mobile / tablet */}
      <div className="space-y-2.5 p-3 lg:hidden">
        {signals.map((s) => (
          <MatrixCard key={s.id} signal={s} />
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1240px] text-xs">
          <thead>
            <tr className="border-b border-border text-left">
              {[
                "Instrument",
                "Category",
                "Price",
                "Signal",
                "Confidence",
                "Regime",
                "TF",
                "Entry",
                "Stop",
                "Target",
                "R:R",
                "Risk",
                "Validation",
                "Strategy",
                "Age",
                "Data",
                "Status",
              ].map((h) => (
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
            {signals.map((s) => {
              const inst = s.instrument;
              return (
                <tr
                  key={s.id}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-card/60"
                >
                  <Cell>
                    <Link
                      to="/signals/$id"
                      params={{ id: s.id }}
                      className="numeric font-semibold hover:text-primary"
                    >
                      {inst?.symbol}
                    </Link>
                    <p className="mt-0.5 max-w-[150px] truncate text-[11px] text-muted-foreground">
                      {inst?.display_name}
                    </p>
                  </Cell>
                  <Cell>
                    <span className="text-muted-foreground">
                      {CATEGORY_LABEL[inst?.category ?? ""] ?? inst?.category}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="numeric">{formatPrice(inst?.current_price)}</span>
                  </Cell>
                  <Cell>
                    <DirectionBadge direction={s.direction} />
                  </Cell>
                  <Cell>
                    <ConfidenceMeter score={s.confidence_score} grade={s.confidence_grade} />
                  </Cell>
                  <Cell>
                    <RegimeBadge regime={s.market_regime} />
                  </Cell>
                  <Cell>
                    <span className="numeric text-muted-foreground">{s.timeframe}</span>
                  </Cell>
                  <Cell>
                    <span className="numeric">{formatPrice(s.entry_price)}</span>
                  </Cell>
                  <Cell>
                    <span className="numeric text-bearish">{formatPrice(s.stop_loss)}</span>
                  </Cell>
                  <Cell>
                    <span className="numeric text-bullish">{formatPrice(s.take_profit_1)}</span>
                  </Cell>
                  <Cell>
                    <span className="numeric">
                      {s.risk_reward_ratio ? formatNum(s.risk_reward_ratio) : "—"}
                    </span>
                  </Cell>
                  <Cell>
                    <RiskBadge rating={s.risk_rating} />
                  </Cell>
                  <Cell>
                    <ValidationBadge status={s.validation_status} />
                  </Cell>
                  <Cell>
                    <span className="max-w-[140px] truncate text-muted-foreground">
                      {s.strategy_name ?? "—"}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="whitespace-nowrap text-muted-foreground">
                      {relativeAge(s.opened_at)}
                    </span>
                  </Cell>
                  <Cell>
                    <FreshnessBadge timestamp={inst?.last_data_at} />
                  </Cell>
                  <Cell>
                    <StatusBadge status={s.status} />
                  </Cell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
