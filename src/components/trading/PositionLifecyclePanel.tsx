import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, XCircle } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useInstruments } from "@/hooks/useCossa";
import { supabase } from "@/integrations/supabase/client";

type PositionRow = {
  id: string;
  order_id: string;
  trading_account_id: string;
  instrument_id: string;
  environment: "demo" | "live";
  provider: string;
  side: "buy" | "sell";
  status: "opening" | "open" | "closing" | "closed" | "failed";
  quantity: number | string;
  entry_price: number | string | null;
  current_price: number | string | null;
  stop_loss: number | string | null;
  take_profit_1: number | string | null;
  unrealized_pnl: number | string;
  realized_pnl: number | string | null;
  close_price: number | string | null;
  close_reason: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  return token;
}

function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

export function PositionLifecyclePanel() {
  const { user } = useAuth();
  const { data: instruments = [] } = useInstruments();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const positions = useQuery({
    queryKey: ["execution-position-ledger", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 20_000,
    queryFn: async () => {
      const token = await accessToken();
      const response = await fetch("/api/execution-position", {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        positions?: PositionRow[];
      };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to load positions");
      return payload.positions ?? [];
    },
  });

  const instrumentName = (instrumentId: string) =>
    instruments.find((item) => item.id === instrumentId)?.display_name ?? instrumentId.slice(0, 8);

  async function positionAction(positionId: string, action: "refresh" | "close") {
    setBusyId(positionId);
    setMessage(null);
    try {
      const token = await accessToken();
      const response = await fetch("/api/execution-position", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ positionId, action }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; result?: unknown };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Position action failed");
      setMessage(action === "close" ? "Position closed and P&L realized." : "Position refreshed from live Deriv price.");
      await positions.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Position action failed");
    } finally {
      setBusyId(null);
    }
  }

  const rows = positions.data ?? [];
  const open = rows.filter((position) => position.status === "open");
  const closed = rows.filter((position) => position.status === "closed").slice(0, 20);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Positions & trade history</h2>
          <p className="text-xs text-muted-foreground">
            Durable execution ledger. Demo prices refresh from live Deriv market data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void positions.refetch()}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
        >
          <RefreshCw className="size-3.5" /> Refresh ledger
        </button>
      </div>

      {message ? <div className="rounded-md border p-3 text-xs text-muted-foreground">{message}</div> : null}

      <div>
        <h3 className="text-sm font-semibold">Open positions</h3>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No open positions.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3">Instrument</th>
                  <th className="py-2 pr-3">Env</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Entry</th>
                  <th className="py-2 pr-3">Current</th>
                  <th className="py-2 pr-3">SL</th>
                  <th className="py-2 pr-3">TP</th>
                  <th className="py-2 pr-3">Unrealized P&L</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {open.map((position) => (
                  <tr key={position.id} className="border-b border-border/60">
                    <td className="py-3 pr-3 font-medium">{instrumentName(position.instrument_id)}</td>
                    <td className="py-3 pr-3 uppercase">{position.environment}</td>
                    <td className="py-3 pr-3 uppercase">{position.side}</td>
                    <td className="py-3 pr-3">{money(position.quantity)}</td>
                    <td className="py-3 pr-3">{money(position.entry_price)}</td>
                    <td className="py-3 pr-3">{money(position.current_price)}</td>
                    <td className="py-3 pr-3">{money(position.stop_loss)}</td>
                    <td className="py-3 pr-3">{money(position.take_profit_1)}</td>
                    <td className="py-3 pr-3 font-semibold">{money(position.unrealized_pnl)}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === position.id}
                          onClick={() => void positionAction(position.id, "refresh")}
                          className="rounded-md border px-2 py-1.5 disabled:opacity-50"
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          disabled={busyId === position.id || position.environment !== "demo"}
                          onClick={() => void positionAction(position.id, "close")}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 disabled:opacity-50"
                        >
                          <XCircle className="size-3.5" /> Close
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Closed trades</h3>
        {closed.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No closed trades yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3">Instrument</th>
                  <th className="py-2 pr-3">Side</th>
                  <th className="py-2 pr-3">Entry</th>
                  <th className="py-2 pr-3">Close</th>
                  <th className="py-2 pr-3">Realized P&L</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2">Closed</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((position) => (
                  <tr key={position.id} className="border-b border-border/60">
                    <td className="py-3 pr-3 font-medium">{instrumentName(position.instrument_id)}</td>
                    <td className="py-3 pr-3 uppercase">{position.side}</td>
                    <td className="py-3 pr-3">{money(position.entry_price)}</td>
                    <td className="py-3 pr-3">{money(position.close_price)}</td>
                    <td className="py-3 pr-3 font-semibold">{money(position.realized_pnl)}</td>
                    <td className="py-3 pr-3">{position.close_reason ?? "—"}</td>
                    <td className="py-3">{position.closed_at ? new Date(position.closed_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
