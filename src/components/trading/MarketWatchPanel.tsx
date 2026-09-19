import { useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";

import type { RankedOpportunity } from "@/lib/opportunity-scanner";
import { cn } from "@/lib/utils";

export type WorkstationMarket = {
  id: string;
  symbol: string;
  displayName: string;
  category?: string | null;
  assetClass?: string | null;
  currentPrice?: number | string | null;
  lastDataAt?: string | null;
};

type Props = {
  markets: WorkstationMarket[];
  selectedSymbol: string;
  opportunities: RankedOpportunity[];
  onSelect: (symbol: string) => void;
};

const FAVORITES_KEY = "cossa-signals-market-watch-favorites";

export function MarketWatchPanel({ markets, selectedSymbol, opportunities, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FAVORITES_KEY);
      setFavorites(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      setFavorites([]);
    }
  }, []);

  function toggleFavorite(symbol: string) {
    setFavorites((rows) => {
      const next = rows.includes(symbol) ? rows.filter((item) => item !== symbol) : [...rows, symbol];
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // Favorites remain available for this session.
      }
      return next;
    });
  }

  const evidenceBySymbol = useMemo(() => {
    const map = new Map<string, RankedOpportunity>();
    for (const item of opportunities) {
      const existing = map.get(item.symbol);
      if (!existing || (item.qualified && !existing.qualified) || item.opportunityScore > existing.opportunityScore) {
        map.set(item.symbol, item);
      }
    }
    return map;
  }, [opportunities]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return markets.filter((market) => {
      if (favoritesOnly && !favorites.includes(market.symbol)) return false;
      if (!needle) return true;
      return `${market.symbol} ${market.displayName} ${market.category ?? ""}`.toLowerCase().includes(needle);
    });
  }, [favorites, favoritesOnly, markets, search]);

  return (
    <aside className="flex h-full min-h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Market Watch</h3>
            <p className="text-[10px] text-muted-foreground">Verified live Deriv markets</p>
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((value) => !value)}
            className={cn("rounded-md border p-2", favoritesOnly ? "border-primary text-primary" : "border-border text-muted-foreground")}
            title="Favorites"
          >
            <Star className={cn("size-3.5", favoritesOnly && "fill-current")} />
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground">
          <Search className="size-3.5" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search symbol"
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_86px_62px] border-b border-border bg-background/50 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Symbol</span>
        <span className="text-right">Last</span>
        <span className="text-right">Signal</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.map((market) => {
          const evidence = evidenceBySymbol.get(market.symbol);
          const selected = market.symbol === selectedSymbol;
          return (
            <div
              key={market.id}
              className={cn(
                "group grid grid-cols-[minmax(0,1fr)_86px_62px] items-center border-b border-border/50 px-2 py-2 text-xs",
                selected ? "bg-primary/10" : "hover:bg-muted/40",
              )}
            >
              <button type="button" onClick={() => onSelect(market.symbol)} className="min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Favorite ${market.symbol}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(market.symbol);
                    }}
                    className={cn("shrink-0 text-muted-foreground hover:text-primary", favorites.includes(market.symbol) && "text-primary")}
                  >
                    <Star className={cn("size-3", favorites.includes(market.symbol) && "fill-current")} />
                  </button>
                  <span className="truncate font-semibold">{market.symbol}</span>
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" title="Live mapping" />
                </div>
                <div className="ml-[18px] truncate text-[10px] text-muted-foreground">{market.displayName}</div>
              </button>
              <button type="button" onClick={() => onSelect(market.symbol)} className="text-right font-mono text-[11px]">
                {price(market.currentPrice)}
              </button>
              <button
                type="button"
                onClick={() => onSelect(market.symbol)}
                className={cn(
                  "text-right text-[10px] font-semibold uppercase",
                  evidence?.direction === "buy"
                    ? "text-primary"
                    : evidence?.direction === "sell"
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {evidence ? evidence.direction.replace("_", " ") : "—"}
              </button>
            </div>
          );
        })}
        {visible.length === 0 ? (
          <p className="p-5 text-center text-xs text-muted-foreground">No matching markets.</p>
        ) : null}
      </div>
    </aside>
  );
}

function price(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(undefined, { maximumFractionDigits: Math.abs(number) >= 1000 ? 3 : 5 });
}
