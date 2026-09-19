import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldCheck, WalletCards } from "lucide-react";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { MarketExecutionChart } from "@/components/trading/MarketExecutionChart";
import { useAuth } from "@/hooks/useAuth";
import { useInstruments, useLiveSignals } from "@/hooks/useCossa";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/trading")({ component: TradingPage });

function TradingPage() {
  return (
    <RequireAuth>
      <AppShell>
        <TradingWorkspace />
      </AppShell>
    </RequireAuth>
  );
}

function TradingWorkspace() {
  const { user } = useAuth();
  const { data: instruments = [] } = useInstruments();
  const { data: signals = [] } = useLiveSignals(100);
  const enabled = instruments.filter((item) => item.instrument_enabled !== false);
  const [symbol, setSymbol] = useState("");
  const selectedSymbol = symbol || enabled[0]?.symbol || "";
  const instrument = enabled.find((item) => item.symbol === selectedSymbol);
  const [timeframe, setTimeframe] = useState("5m");
  const [accountId, setAccountId] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("1");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const accounts = useQuery({
    queryKey: ["trading_accounts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_accounts")
        .select("id,provider,account_label,account_environment,execution_mode,enabled,currency,emergency_stop")
        .eq("user_id", user!.id)
        .order("account_environment");
      if (error) throw error;
      return data ?? [];
    },
  });

  const candles = useQuery({
    queryKey: ["market_candles", instrument?.id, timeframe],
    enabled: Boolean(instrument?.id),
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_candles")
        .select("open_time,close")
        .eq("instrument_id", instrument!.id)
        .eq("timeframe", timeframe)
        .order("open_time", { ascending: false })
        .limit(180);
      if (error) throw error;
      return (data ?? []).reverse().map((row) => ({
        at: new Date(row.open_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        close: Number(row.close),
      }));
    },
  });

  const selectedAccount = (accounts.data ?? []).find((account) => account.id === accountId) ?? accounts.data?.[0];
  const activeSignal = useMemo(
    () => signals.find((signal) => signal.instrument?.symbol === selectedSymbol),
    [signals, selectedSymbol],
  );
  const currentPrice = Number(instrument?.current_price ?? candles.data?.at(-1)?.close ?? 0) || null;

  function loadSignalPlan() {
    if (!activeSignal) return;
    setSide(activeSignal.direction === "sell" ? "sell" : "buy");
    setEntry(String(activeSignal.entry_price ?? currentPrice ?? ""));
    setStopLoss(String(activeSignal.stop_loss ?? ""));
    setTakeProfit(String(activeSignal.take_profit_1 ?? ""));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Execution workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">Cossa Trading Terminal</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            One trading surface for Demo and Live. Account environment changes the execution adapter; analysis, charting and order lifecycle stay unified.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" /> Server-controlled execution
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">Instrument
              <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={selectedSymbol} onChange={(event) => setSymbol(event.target.value)}>
                {enabled.map((item) => <option key={item.id} value={item.symbol}>{item.display_name}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Timeframe
              <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={timeframe} onChange={(event) => setTimeframe(event.target.value)}>
                {["1m", "5m", "15m", "30m", "1h", "4h"].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Trading account
              <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={selectedAccount?.id ?? ""} onChange={(event) => setAccountId(event.target.value)}>
                {(accounts.data ?? []).map((account) => <option key={account.id} value={account.id}>{account.account_label} · {account.account_environment.toUpperCase()}</option>)}
              </select>
            </label>
          </div>

          <MarketExecutionChart
            symbol={selectedSymbol || "Market"}
            timeframe={timeframe}
            data={candles.data ?? []}
            currentPrice={currentPrice}
            entryPrice={Number(entry) || activeSignal?.entry_price || null}
            stopLoss={Number(stopLoss) || activeSignal?.stop_loss || null}
            takeProfit1={Number(takeProfit) || activeSignal?.take_profit_1 || null}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h2 className="font-semibold">Cossa analysis</h2></div>
              {activeSignal ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Decision:</span> <strong className="uppercase">{activeSignal.direction}</strong> · {activeSignal.confidence_score}% confidence</p>
                  <p className="text-muted-foreground">{activeSignal.ai_summary ?? activeSignal.signal_reason ?? "Signal plan available."}</p>
                  <button type="button" onClick={loadSignalPlan} className="rounded-md border border-border-gold px-3 py-2 text-xs font-medium text-primary">Load signal into order ticket</button>
                </div>
              ) : <p className="mt-3 text-sm text-muted-foreground">No active signal for this instrument. Manual analysis remains available from the chart.</p>}
            </section>
            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2"><WalletCards className="size-4 text-primary" /><h2 className="font-semibold">Account state</h2></div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p>Environment: <strong className="text-foreground">{selectedAccount?.account_environment?.toUpperCase() ?? "Not configured"}</strong></p>
                <p>Provider: <strong className="text-foreground">{selectedAccount?.provider ?? "—"}</strong></p>
                <p>Mode: <strong className="text-foreground">{selectedAccount?.execution_mode ?? "—"}</strong></p>
                <p>Emergency stop: <strong className="text-foreground">{selectedAccount?.emergency_stop ? "ACTIVE" : "Clear"}</strong></p>
              </div>
            </section>
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-4 xl:sticky xl:top-20 xl:self-start">
          <h2 className="text-lg font-semibold">Order ticket</h2>
          <p className="mt-1 text-xs text-muted-foreground">The ticket uses the same lifecycle for Demo and Live.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSide("buy")} className={`rounded-md border p-3 text-sm font-semibold ${side === "buy" ? "border-primary text-primary" : "border-border"}`}>BUY</button>
            <button type="button" onClick={() => setSide("sell")} className={`rounded-md border p-3 text-sm font-semibold ${side === "sell" ? "border-primary text-primary" : "border-border"}`}>SELL</button>
          </div>
          <div className="mt-4 space-y-3">
            {[{ label: "Amount / size", value: amount, set: setAmount }, { label: "Entry", value: entry, set: setEntry }, { label: "Stop loss", value: stopLoss, set: setStopLoss }, { label: "Take profit", value: takeProfit, set: setTakeProfit }].map((field) => (
              <label key={field.label} className="block text-xs text-muted-foreground">{field.label}
                <input type="number" step="any" value={field.value} onChange={(event) => field.set(event.target.value)} className="mt-1 w-full rounded-md border bg-background p-2.5 text-sm text-foreground" />
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground">
            {selectedAccount?.account_environment === "live" ? "LIVE account selected. Submission will use the server-side live confirmation path." : "DEMO account selected. Submission will use the server-side paper execution path."}
          </div>
          <button type="button" disabled className="mt-4 w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            Submit {side.toUpperCase()} · server endpoint wiring next
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Order creation remains disabled in the browser until the authenticated server endpoint is connected. We do not weaken execution RLS.</p>
        </aside>
      </div>
    </div>
  );
}
