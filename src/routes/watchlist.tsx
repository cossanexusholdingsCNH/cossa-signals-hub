import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Star, Plus, Trash2 } from "lucide-react";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { DirectionBadge, FreshnessBadge } from "@/components/cossa/badges";
import { useAuth } from "@/hooks/useAuth";
import {
  useInstruments,
  useLiveSignals,
  usePlatformControls,
  useToggleWatchlistItem,
  useWatchlist,
} from "@/hooks/useCossa";
import { formatPrice } from "@/lib/cossa";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — Cossa Signals" },
      {
        name: "description",
        content: "Track the instruments that matter to you and see their live Cossa Signals posture in one place.",
      },
      { property: "og:title", content: "Watchlist — Cossa Signals" },
      { property: "og:description", content: "Your instruments, their regime and their current signal posture." },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  return (
    <RequireAuth>
      <WatchlistContent />
    </RequireAuth>
  );
}

function WatchlistContent() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useWatchlist(user?.id);
  const { data: instruments } = useInstruments();
  const { data: signals } = useLiveSignals(300);
  const { data: controls } = usePlatformControls();
  const toggle = useToggleWatchlistItem(user?.id);
  const [pick, setPick] = useState("");

  const items = data?.items ?? [];
  const watchedIds = new Set(items.map((i) => i.instrument_id));
  const available = useMemo(
    () => (instruments ?? []).filter((i) => !watchedIds.has(i.id)),
    [instruments, items],
  );

  const signalFor = (instrumentId: string) =>
    (signals ?? []).find((s) => s.instrument_id === instrumentId);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Your desk"
        title="Watchlist"
        description="A focused view of the instruments you follow. Saved to your account and protected by row-level security — only you can see it."
      />

      <Panel>
        <PanelHeader
          title="Add an instrument"
          subtitle={`${items.length} instrument${items.length === 1 ? "" : "s"} tracked`}
        />
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="min-w-[220px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-border-gold"
          >
            <option value="">Select an instrument…</option>
            {available.map((i) => (
              <option key={i.id} value={i.id}>
                {i.symbol} — {i.display_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pick || !data?.list || toggle.isPending}
            onClick={() => {
              if (!pick || !data?.list) return;
              toggle.mutate(
                { watchlistId: data.list.id, instrumentId: pick },
                { onSuccess: () => setPick("") },
              );
            }}
            className="flex items-center gap-1.5 rounded-md border border-border-gold bg-gold-dim px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
          >
            <Plus className="size-3.5" />
            Add
          </button>
          {toggle.isError ? (
            <span className="text-xs text-bearish">Unable to update your watchlist.</span>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Tracked instruments" subtitle="Live price, freshness and current posture" />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load your watchlist.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading watchlist…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Star className="size-5" />}
            title="Your watchlist is empty"
            description="Add instruments above to keep them in front of you."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => {
              const sig = signalFor(item.instrument_id);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="numeric text-sm font-semibold">
                      {item.instrument?.symbol ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.instrument?.display_name ?? ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="numeric text-sm">
                      {formatPrice(item.instrument?.current_price ?? null)}
                    </span>
                    <FreshnessBadge
                      timestamp={item.instrument?.last_data_at ?? null}
                      {...(controls ? { staleSeconds: controls.stale_threshold_seconds } : {})}
                    />
                    {sig ? (
                      <DirectionBadge direction={sig.direction} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">No live signal</span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${item.instrument?.symbol ?? "instrument"}`}
                      onClick={() =>
                        toggle.mutate({
                          watchlistId: item.watchlist_id,
                          instrumentId: item.instrument_id,
                          existingItemId: item.id,
                        })
                      }
                      className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-bearish hover:text-bearish"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
