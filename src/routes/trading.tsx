import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldCheck, WalletCards } from "lucide-react";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { MarketExecutionChart } from "@/components/trading/MarketExecutionChart";
import { PositionLifecyclePanel } from "@/components/trading/PositionLifecyclePanel";
import { useAuth } from "@/hooks/useAuth";
import { useInstruments } from "@/hooks/useCossa";
import { useDerivLiveTick } from "@/hooks/useDerivLiveTick";
import { useOpportunityScanner } from "@/hooks/useOpportunityScanner";
import { supabase } from "@/integrations/supabase/client";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h"] as const;
type TradingSearch = { symbol?: string; timeframe?: string };

export const Route = createFileRoute("/trading")({
  validateSearch: (search: Record<string, unknown>): TradingSearch => ({
    symbol: typeof search.symbol === "string" ? search.symbol : undefined,
    timeframe: typeof search.timeframe === "string" ? search.timeframe : undefined,
  }),
  component: TradingPage,
});

function TradingPage() {
  return (
    <RequireAuth>
      <TradingWorkspace />
    </RequireAuth>
  );
}

function TradingWorkspace() {
  const search = Route.useSearch();
  const { user } = useAuth();
  const { data: instruments = [] } = useInstruments();
  const scanner = useOpportunityScanner(15_000);
  const currentEvidence = scanner.data?.opportunities ?? [];

  const tradable = useMemo(
    () =>
      instruments
        .filter(
          (item) =>
            item.enabled !== false &&
            item.provider === "deriv" &&
            !item.is_demo,
        )
        .sort(
          (a, b) =>
            (b.last_data_at ? new Date(b.last_data_at).getTime() : 0) -
            (a.last_data_at ? new Date(a.last_data_at).getTime() : 0),
        ),
    [instruments],
  );

  const preferredOpportunity = currentEvidence.find(
    (item) =>
      item.qualified &&
      (item.direction === "buy" || item.direction === "sell") &&
      tradable.some((instrument) => instrument.symbol === item.symbol),
  );

  const requestedInstrument = search.symbol
    ? tradable.find((item) => item.symbol === search.symbol)
    : undefined;
  const requestedTimeframe =
    requestedInstrument && search.timeframe && TIMEFRAMES.includes(search.timeframe as (typeof TIMEFRAMES)[number])
      ? search.timeframe
      : undefined;

  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [accountId, setAccountId] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("1");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedSymbol =
    symbol || requestedInstrument?.symbol || preferredOpportunity?.symbol || tradable[0]?.symbol || "";
  const instrument = tradable.find((item) => item.symbol === selectedSymbol);
  const symbolEvidence = currentEvidence.filter((item) => item.symbol === selectedSymbol);
  const evidenceDefault = symbolEvidence.find(
    (item) => item.qualified && (item.direction === "buy" || item.direction === "sell"),
  ) ?? symbolEvidence[0];
  const selectedTimeframe =
    timeframe || requestedTimeframe || evidenceDefault?.timeframe || instrument?.timeframe_default || "5m";
  const activeOpportunity =
    symbolEvidence.find((item) => item.timeframe === selectedTimeframe) ?? evidenceDefault;

  const rejectedDeepLink = Boolean(
    search.symbol && instruments.length > 0 && !requestedInstrument,
  );

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

  const streamConfig = useQuery({
    queryKey: ["market_stream_config", instrument?.id],
    enabled: Boolean(instrument?.id),
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication required for live market stream");
      const response = await fetch(
        `/api/market-stream-config?instrumentId=${encodeURIComponent(instrument!.id)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        stream?: {
          provider?: string | null;
          providerSymbol?: string | null;
          supportsStreaming?: boolean;
        } | null;
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? "Unable to load stream config");
      return payload.stream ?? null;
    },
  });

  const liveTick = useDerivLiveTick(
    streamConfig.data?.provider === "deriv" && streamConfig.data.supportsStreaming
      ? streamConfig.data.providerSymbol
      : null,
  );

  const candles = useQuery({
    queryKey: ["market_candles", instrument?.id, selectedTimeframe],
    enabled: Boolean(instrument?.id),
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_candles")
        .select("open_time,close_time,open,high,low,close")
        .eq("instrument_id", instrument!.id)
        .eq("timeframe", selectedTimeframe)
        .eq("is_closed", true)
        .order("open_time", { ascending: false })
        .limit(180);
      if (error) throw error;
      return (data ?? []).reverse().map((row) => ({
        openTime: row.open_time,
        closeTime: row.close_time,
        label: new Date(row.open_time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
      }));
    },
  });

  const selectedAccount =
    (accounts.data ?? []).find((account) => account.id === accountId) ?? accounts.data?.[0];
  const fallbackPrice = Number(instrument?.current_price ?? candles.data?.at(-1)?.close ?? 0);
  const currentPrice =
    liveTick.price ??
    (Number.isFinite(fallbackPrice) && fallbackPrice > 0 ? fallbackPrice : null);

  function selectInstrument(nextSymbol: string) {
    setSymbol(nextSymbol);
    setTimeframe("");
    setEntry("");
    setStopLoss("");
    setTakeProfit("");
    setResult(null);
  }

  function loadEvidencePlan() {
    if (!activeOpportunity) return;
    if (activeOpportunity.direction === "buy" || activeOpportunity.direction === "sell") {
      setSide(activeOpportunity.direction);
    }
    setTimeframe(activeOpportunity.timeframe || selectedTimeframe);
    setEntry(String(activeOpportunity.entry ?? currentPrice ?? ""));
    setStopLoss(String(activeOpportunity.stopLoss ?? ""));
    setTakeProfit(String(activeOpportunity.takeProfit1 ?? ""));
  }

  async function submitOrder() {
    setResult(null);
    if (!instrument?.id || !selectedAccount?.id) {
      setResult({ ok: false, message: "Set up a Demo account and select an instrument first." });
      return;
    }

    const executableEvidence =
      activeOpportunity &&
      activeOpportunity.qualified &&
      (activeOpportunity.direction === "buy" || activeOpportunity.direction === "sell")
        ? activeOpportunity
        : null;

    if (selectedAccount.account_environment === "demo" && !executableEvidence) {
      setResult({
        ok: false,
        message: "Demo execution requires a current qualified BUY/SELL Cossa evidence set for this instrument and timeframe.",
      });
      return;
    }

    const requestedEntry = Number(entry || executableEvidence?.entry || currentPrice);
    const requestedAmount = Number(amount);
    const sl = Number(stopLoss || executableEvidence?.stopLoss);
    const tp = Number(takeProfit || executableEvidence?.takeProfit1);
    if (![requestedEntry, requestedAmount, sl, tp].every((value) => Number.isFinite(value) && value > 0)) {
      setResult({
        ok: false,
        message: "Amount, entry, stop loss and take profit must all be valid positive numbers.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session has expired. Sign in again.");
      const response = await fetch("/api/execution-order", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tradingAccountId: selectedAccount.id,
          instrumentId: instrument.id,
          side,
          requestedAmount,
          requestedEntry,
          stopLoss: sl,
          takeProfit1: tp,
          signalEvidenceId: executableEvidence?.id ?? null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        order?: { id?: string; status?: string };
        lifecycle?: { positionId?: string } | null;
        decision?: {
          approved?: boolean;
          confirmationRequired?: boolean;
          rejectionReasons?: string[];
        };
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? "Order submission failed");

      if (payload.decision?.confirmationRequired) {
        setResult({
          ok: true,
          message: `Live order ${payload.order?.id ?? ""} created and awaiting explicit confirmation.`,
        });
      } else if (payload.decision?.approved && payload.lifecycle?.positionId) {
        setResult({
          ok: true,
          message: `Demo order filled. Position ${payload.lifecycle.positionId} is now open in the execution ledger.`,
        });
      } else if (payload.decision?.approved) {
        setResult({
          ok: true,
          message: `Demo order ${payload.order?.id ?? ""} passed server risk checks.`,
        });
      } else {
        setResult({
          ok: false,
          message:
            payload.decision?.rejectionReasons?.join("; ") ||
            "Order was rejected by execution risk controls.",
        });
      }
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Order submission failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const demoExecutable = Boolean(
    activeOpportunity?.qualified &&
      (activeOpportunity.direction === "buy" || activeOpportunity.direction === "sell"),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Execution workspace</p>
          <h1 className="mt-1 text-2xl font-semibold">Cossa Trading Terminal</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Verified live Deriv charting and immutable Cossa evidence. Demo execution remains server-controlled and risk-gated.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" /> Server-controlled execution
        </div>
      </div>

      {rejectedDeepLink ? (
        <div className="rounded-xl border border-caution/40 bg-caution/5 p-4 text-xs text-caution">
          {search.symbol} is not currently available through the verified live Deriv execution feed. The terminal opened {selectedSymbol || "the next verified live market"} instead. No instrument is silently substituted as if it were {search.symbol}.
        </div>
      ) : null}

      {!accounts.isLoading && (accounts.data ?? []).length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-gold/50 bg-card p-4">
          <div>
            <p className="text-sm font-semibold">Demo account required</p>
            <p className="mt-1 text-xs text-muted-foreground">Create the virtual Deriv Demo account first so the risk engine has a balance, snapshot and daily risk baseline.</p>
          </div>
          <Link to="/demo-setup" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Set up Demo account</Link>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">Instrument
              <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={selectedSymbol} onChange={(event) => selectInstrument(event.target.value)}>
                {tradable.map((item) => (
                  <option key={item.id} value={item.symbol}>{item.display_name} · LIVE</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Timeframe
              <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={selectedTimeframe} onChange={(event) => setTimeframe(event.target.value)}>
                {TIMEFRAMES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Trading account
              <select className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" value={selectedAccount?.id ?? ""} onChange={(event) => setAccountId(event.target.value)}>
                {(accounts.data ?? []).length === 0 ? <option value="">No account configured</option> : null}
                {(accounts.data ?? []).map((account) => (
                  <option key={account.id} value={account.id}>{account.account_label} · {account.account_environment.toUpperCase()}</option>
                ))}
              </select>
            </label>
          </div>

          <MarketExecutionChart
            symbol={selectedSymbol || "Market"}
            timeframe={selectedTimeframe}
            data={candles.data ?? []}
            currentPrice={currentPrice}
            liveEpoch={liveTick.epoch}
            liveConnected={liveTick.connected}
            bid={liveTick.bid}
            ask={liveTick.ask}
            entryPrice={Number(entry) || activeOpportunity?.entry || null}
            stopLoss={Number(stopLoss) || activeOpportunity?.stopLoss || null}
            takeProfit1={Number(takeProfit) || activeOpportunity?.takeProfit1 || null}
          />

          {streamConfig.data?.provider === "deriv" && liveTick.error ? (
            <div className="rounded-lg border border-destructive/40 p-3 text-xs text-destructive">Live Deriv stream: {liveTick.error}</div>
          ) : null}
          {candles.isFetched && (candles.data ?? []).length === 0 ? (
            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">No stored {selectedTimeframe} OHLC candles are available for {selectedSymbol || "this instrument"}. Choose another available timeframe.</div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h2 className="font-semibold">Cossa analysis</h2></div>
              {activeOpportunity ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Decision:</span> <strong className="uppercase">{activeOpportunity.direction.replace("_", " ")}</strong> · {activeOpportunity.confidenceScore}% signal confidence</p>
                  <p><span className="text-muted-foreground">Data confidence:</span> <strong>{activeOpportunity.dataConfidenceScore ?? "—"}%</strong> · R:R {activeOpportunity.riskRewardRatio?.toFixed(2) ?? "—"}</p>
                  <p><span className="text-muted-foreground">Structure:</span> {activeOpportunity.structure?.trend ?? "unavailable"} · breakout {activeOpportunity.structure?.breakout ?? "—"}</p>
                  {!activeOpportunity.qualified ? <p className="text-caution">Not executable: {activeOpportunity.qualificationReasons.slice(0, 2).join(" · ")}</p> : null}
                  {activeOpportunity.direction === "buy" || activeOpportunity.direction === "sell" ? (
                    <button type="button" onClick={loadEvidencePlan} className="rounded-md border border-border-gold px-3 py-2 text-xs font-medium text-primary">Load current evidence into order ticket</button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>No current Cossa evidence for this instrument/timeframe yet.</p>
                  {preferredOpportunity ? (
                    <button type="button" onClick={() => selectInstrument(preferredOpportunity.symbol)} className="rounded-md border border-border-gold px-3 py-2 text-xs font-medium text-primary">Open {preferredOpportunity.displayName}</button>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2"><WalletCards className="size-4 text-primary" /><h2 className="font-semibold">Account state</h2></div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p>Environment: <strong className="text-foreground">{selectedAccount?.account_environment?.toUpperCase() ?? "Not configured"}</strong></p>
                <p>Provider: <strong className="text-foreground">{selectedAccount?.provider ?? "—"}</strong></p>
                <p>Mode: <strong className="text-foreground">{selectedAccount?.execution_mode ?? "—"}</strong></p>
                <p>Emergency stop: <strong className="text-foreground">{selectedAccount?.emergency_stop ? "ACTIVE" : "Clear"}</strong></p>
              </div>
              {!selectedAccount ? <Link to="/demo-setup" className="mt-3 inline-flex rounded-md border border-border-gold px-3 py-2 text-xs font-medium text-primary">Set up Deriv Demo</Link> : null}
            </section>
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-4 xl:sticky xl:top-20 xl:self-start">
          <h2 className="text-lg font-semibold">Order ticket</h2>
          <p className="mt-1 text-xs text-muted-foreground">Demo trades use qualified immutable evidence plus a fresh server-side Deriv tick.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSide("buy")} className={`rounded-md border p-3 text-sm font-semibold ${side === "buy" ? "border-primary text-primary" : "border-border"}`}>BUY</button>
            <button type="button" onClick={() => setSide("sell")} className={`rounded-md border p-3 text-sm font-semibold ${side === "sell" ? "border-primary text-primary" : "border-border"}`}>SELL</button>
          </div>
          <div className="mt-4 space-y-3">
            {[
              { label: "Amount / size", value: amount, set: setAmount },
              { label: "Entry", value: entry, set: setEntry },
              { label: "Stop loss", value: stopLoss, set: setStopLoss },
              { label: "Take profit", value: takeProfit, set: setTakeProfit },
            ].map((field) => (
              <label key={field.label} className="block text-xs text-muted-foreground">{field.label}
                <input type="number" step="any" value={field.value} onChange={(event) => field.set(event.target.value)} className="mt-1 w-full rounded-md border bg-background p-2.5 text-sm text-foreground" />
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground">
            {!selectedAccount
              ? "No trading account configured. Set up the Deriv Demo account before submitting orders."
              : selectedAccount.account_environment === "live"
                ? "LIVE account selected. Submission creates an order awaiting explicit confirmation."
                : demoExecutable
                  ? "DEMO account selected. Current qualified Cossa evidence is available; the server will independently re-qualify it and verify a fresh Deriv tick before execution."
                  : "DEMO account selected, but the current evidence is WAIT/REJECTED or missing. Analysis remains available; execution fails closed."}
          </div>
          {!selectedAccount ? (
            <Link to="/demo-setup" className="mt-4 flex w-full justify-center rounded-md border border-border-gold px-4 py-3 text-sm font-semibold text-primary">Set up Demo account</Link>
          ) : (
            <button type="button" disabled={submitting || !instrument || selectedAccount.emergency_stop || (selectedAccount.account_environment === "demo" && !demoExecutable)} onClick={() => void submitOrder()} className="mt-4 w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Submitting…" : `Submit ${side.toUpperCase()}`}</button>
          )}
          {result ? <div className={`mt-3 rounded-md border p-3 text-xs ${result.ok ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive"}`}>{result.message}</div> : null}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">The browser sends an authenticated intent only. Qualification, market freshness, risk evaluation and fill decisions remain server-side.</p>
        </aside>
      </div>

      <PositionLifecyclePanel />
    </div>
  );
}
