import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BookOpenCheck, History, ListOrdered, Radio, TerminalSquare } from "lucide-react";

import { PositionLifecyclePanel } from "@/components/trading/PositionLifecyclePanel";
import { useAuth } from "@/hooks/useAuth";
import { useInstruments } from "@/hooks/useCossa";
import { supabase } from "@/integrations/supabase/client";
import type { RankedOpportunity } from "@/lib/opportunity-scanner";
import { cn } from "@/lib/utils";

type Tab = "positions" | "orders" | "history" | "signals" | "journal";

type Props = {
  opportunities: RankedOpportunity[];
  liveConnected: boolean;
  symbol: string;
  timeframe: string;
  streamError?: string | null;
  executionMessage?: { ok: boolean; message: string } | null;
};

const TABS: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: "positions", label: "Positions", icon: Activity },
  { id: "orders", label: "Orders", icon: ListOrdered },
  { id: "history", label: "History", icon: History },
  { id: "signals", label: "Signals", icon: Radio },
  { id: "journal", label: "Journal", icon: TerminalSquare },
];

export function TradingTerminalDock({
  opportunities,
  liveConnected,
  symbol,
  timeframe,
  streamError,
  executionMessage,
}: Props) {
  const [tab, setTab] = useState<Tab>("positions");
  const { user } = useAuth();
  const { data: instruments = [] } = useInstruments();

  const orders = useQuery({
    queryKey: ["workstation-execution-orders", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execution_orders")
        .select(
          "id,instrument_id,side,status,execution_mode,requested_entry,stop_loss,take_profit_1,requested_amount,average_fill_price,realized_pnl,rejection_reason,error_message,created_at,filled_at,closed_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = useQuery({
    queryKey: ["workstation-execution-events", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execution_events")
        .select("id,order_id,event_type,old_status,new_status,payload,created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const instrumentName = (instrumentId: string) =>
    instruments.find((item) => item.id === instrumentId)?.display_name ?? instrumentId.slice(0, 8);

  const activeOrders = useMemo(
    () =>
      (orders.data ?? []).filter(
        (order) => !["closed", "rejected", "cancelled", "failed"].includes(order.status),
      ),
    [orders.data],
  );
  const historyOrders = useMemo(
    () =>
      (orders.data ?? []).filter((order) =>
        ["closed", "rejected", "cancelled", "failed"].includes(order.status),
      ),
    [orders.data],
  );

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-background/60 px-2 pt-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors",
                tab === item.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" /> {item.label}
            </button>
          );
        })}
        <div className="ml-auto hidden items-center gap-2 px-3 text-[11px] text-muted-foreground md:flex">
          <span className={cn("size-2 rounded-full", liveConnected ? "bg-primary" : "bg-caution")} />
          {symbol || "Market"} · {timeframe} · {liveConnected ? "stream live" : "connecting"}
        </div>
      </div>

      <div className="max-h-[390px] overflow-auto p-3">
        {tab === "positions" ? <PositionLifecyclePanel /> : null}

        {tab === "orders" ? (
          <LedgerTable
            rows={activeOrders}
            instrumentName={instrumentName}
            empty="No active orders."
          />
        ) : null}

        {tab === "history" ? (
          <LedgerTable
            rows={historyOrders}
            instrumentName={instrumentName}
            empty="No completed or rejected orders yet."
          />
        ) : null}

        {tab === "signals" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4">Market</th>
                  <th className="py-2 pr-4">TF</th>
                  <th className="py-2 pr-4">Decision</th>
                  <th className="py-2 pr-4">Signal</th>
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">R:R</th>
                  <th className="py-2 pr-4">Qualification</th>
                  <th className="py-2">Evidence age</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.slice(0, 50).map((item) => (
                  <tr key={item.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{item.displayName}</td>
                    <td className="py-2 pr-4">{item.timeframe}</td>
                    <td className="py-2 pr-4 font-semibold uppercase">{item.direction.replace("_", " ")}</td>
                    <td className="py-2 pr-4">{item.confidenceScore}%</td>
                    <td className="py-2 pr-4">{item.dataConfidenceScore ?? "—"}%</td>
                    <td className="py-2 pr-4">{item.riskRewardRatio?.toFixed(2) ?? "—"}</td>
                    <td className={cn("py-2 pr-4 font-medium", item.qualified ? "text-primary" : "text-caution")}>
                      {item.qualified ? "QUALIFIED" : "WAIT / REJECTED"}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {Math.max(0, Math.round((Date.now() - new Date(item.generatedAt).getTime()) / 60_000))}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {opportunities.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No current immutable evidence.</p>
            ) : null}
          </div>
        ) : null}

        {tab === "journal" ? (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <StatusCard label="Market stream" value={liveConnected ? "CONNECTED" : "CONNECTING"} good={liveConnected} />
              <StatusCard label="Workspace" value={`${symbol || "—"} · ${timeframe}`} good />
              <StatusCard label="Last execution" value={executionMessage?.message ?? "No new execution message"} good={executionMessage?.ok !== false} />
            </div>
            {streamError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                Stream: {streamError}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Event</th>
                    <th className="py-2 pr-4">Order</th>
                    <th className="py-2 pr-4">From</th>
                    <th className="py-2">To</th>
                  </tr>
                </thead>
                <tbody>
                  {(events.data ?? []).map((event) => (
                    <tr key={event.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(event.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{event.event_type}</td>
                      <td className="py-2 pr-4 font-mono">{event.order_id.slice(0, 8)}</td>
                      <td className="py-2 pr-4">{event.old_status ?? "—"}</td>
                      <td className="py-2">{event.new_status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(events.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No execution journal events yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LedgerTable({
  rows,
  instrumentName,
  empty,
}: {
  rows: Array<Record<string, any>>;
  instrumentName: (id: string) => string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-left text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-4">Time</th>
            <th className="py-2 pr-4">Instrument</th>
            <th className="py-2 pr-4">Side</th>
            <th className="py-2 pr-4">Mode</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Size</th>
            <th className="py-2 pr-4">Entry</th>
            <th className="py-2 pr-4">SL</th>
            <th className="py-2 pr-4">TP</th>
            <th className="py-2">P&L / reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id} className="border-b border-border/50">
              <td className="py-2 pr-4 text-muted-foreground">{new Date(order.created_at).toLocaleString()}</td>
              <td className="py-2 pr-4 font-medium">{instrumentName(order.instrument_id)}</td>
              <td className="py-2 pr-4 uppercase">{order.side}</td>
              <td className="py-2 pr-4">{order.execution_mode}</td>
              <td className="py-2 pr-4 uppercase">{order.status}</td>
              <td className="py-2 pr-4">{Number(order.requested_amount).toFixed(2)}</td>
              <td className="py-2 pr-4">{numberOrDash(order.requested_entry)}</td>
              <td className="py-2 pr-4">{numberOrDash(order.stop_loss)}</td>
              <td className="py-2 pr-4">{numberOrDash(order.take_profit_1)}</td>
              <td className="py-2">
                {order.realized_pnl != null
                  ? `P&L ${numberOrDash(order.realized_pnl)}`
                  : order.rejection_reason ?? order.error_message ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusCard({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <BookOpenCheck className="size-3.5" /> {label}
      </div>
      <p className={cn("mt-1 text-xs font-medium", good ? "text-foreground" : "text-destructive")}>{value}</p>
    </div>
  );
}

function numberOrDash(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "—";
}
