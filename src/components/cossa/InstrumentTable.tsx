import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/cossa/primitives";
import { DemoBadge, FreshnessBadge, RiskBadge, ValidationBadge } from "@/components/cossa/badges";
import { CATEGORY_LABEL, formatPrice } from "@/lib/cossa";
import type { Instrument } from "@/lib/types";

/** Read-only instrument list. Prices come from the backend only — never computed here. */
export function InstrumentTable({
  instruments,
  staleSeconds,
  emptyTitle = "No instruments configured yet",
  emptyDescription = "Instrument coverage appears once the Cossa Signals engine registers markets.",
}: {
  instruments: Instrument[];
  staleSeconds?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (instruments.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="border-b border-border text-left">
              {["Instrument", "Category", "Price", "Data", "Risk", "Validation", "Provider", "Default TF", "Market"].map(
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
            {instruments.map((i) => (
              <tr key={i.id} className="border-b border-border/50 last:border-0 hover:bg-card/60">
                <td className="px-3 py-2.5">
                  <Link
                    to="/instruments/$symbol"
                    params={{ symbol: i.symbol }}
                    className="numeric font-semibold hover:text-primary"
                  >
                    {i.symbol}
                  </Link>
                  <span className="ml-2 text-muted-foreground">{i.display_name}</span>
                  {i.is_demo ? (
                    <span className="ml-2">
                      <DemoBadge />
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {CATEGORY_LABEL[i.category] ?? i.category}
                </td>
                <td className="numeric px-3 py-2.5">{formatPrice(i.current_price)}</td>
                <td className="px-3 py-2.5">
                  <FreshnessBadge
                    timestamp={i.last_data_at}
                    {...(staleSeconds ? { staleSeconds } : {})}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <RiskBadge rating={i.risk_rating} />
                </td>
                <td className="px-3 py-2.5">
                  <ValidationBadge status={i.validation_status} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{i.provider}</td>
                <td className="numeric px-3 py-2.5 text-muted-foreground">{i.timeframe_default}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{i.market_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-border/60 lg:hidden">
        {instruments.map((i) => (
          <li key={i.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Link
                to="/instruments/$symbol"
                params={{ symbol: i.symbol }}
                className="numeric text-sm font-semibold hover:text-primary"
              >
                {i.symbol}
              </Link>
              <span className="numeric text-sm">{formatPrice(i.current_price)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{i.display_name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RiskBadge rating={i.risk_rating} />
              <ValidationBadge status={i.validation_status} />
              <FreshnessBadge
                timestamp={i.last_data_at}
                {...(staleSeconds ? { staleSeconds } : {})}
              />
              {i.is_demo ? <DemoBadge /> : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
