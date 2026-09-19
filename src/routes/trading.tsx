import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Columns3,
  LockKeyhole,
  PanelRight,
  Rows3,
  ShieldCheck,
  Square,
  TerminalSquare,
  WalletCards,
} from "lucide-react";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { MarketExecutionChart } from "@/components/trading/MarketExecutionChart";
import { MarketWatchPanel } from "@/components/trading/MarketWatchPanel";
import { TradingTerminalDock } from "@/components/trading/TradingTerminalDock";
import { useAuth } from "@/hooks/useAuth";
import { useInstruments } from "@/hooks/useCossa";
import { useDerivLiveTick } from "@/hooks/useDerivLiveTick";
import { useOpportunityScanner } from "@/hooks/useOpportunityScanner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h"] as const;
type TradingSearch = { symbol?: string; timeframe?: string };
type LayoutMode = "split" | "ticket-below" | "focus";

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
  const { data: instruments = [], refetch: refetchInstruments } = useInstruments();
  const scanner = useOpportunityScanner(15_000);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refetchInstruments();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refetchInstruments]);
  const currentEvidence = scanner.data?.opportunities ?? [];

  const tradable = useMemo(
    () =>
      instruments
        .filter((item) => item.enabled !== false && item.provider === "deriv" && !item.is_demo)
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
    requestedInstrument &&
    search.timeframe &&
    TIMEFRAMES.includes(search.timeframe as (typeof TIMEFRAMES)[number])
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
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("ticket-below");
  const [showMarketWatch, setShowMarketWatch] = useState(true);
  const [showTerminalDock, setShowTerminalDock] = useState(true);

  const selectedSymbol =
    symbol || requestedInstrument?.symbol || preferredOpportunity?.symbol || tradable[0]?.symbol || "";
  const instrument = tradable.find((item) => item.symbol === selectedSymbol);
  const symbolEvidence = currentEvidence.filter((item) => item.symbol === selectedSymbol);
  const evidenceDefault =
    symbolEvidence.find(
      (item) => item.qualified && (item.direction === "buy" || item.direction === "sell"),
    ) ?? symbolEvidence[0];
  const selectedTimeframe =
    timeframe || requestedTimeframe || evidenceDefault?.timeframe || instrument?.timeframe_default || "5m";
  const activeOpportunity =
    symbolEvidence.find((item) => item.timeframe === selectedTimeframe) ?? evidenceDefault;

  const rejectedDeepLink = Boolean(search.symbol && instruments.length > 0 && !requestedInstrument);

  const accounts = useQuery({
    queryKey: ["trading_accounts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_accounts")
        .select(
          "id,provider,account_label,account_environment,execution_mode,enabled,currency,emergency_stop",
        )
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
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to load stream config");
      }
      return payload.stream ?? null;
    },
  });

  const liveTick = useDerivLiveTick(
    streamConfig.data?.provider === "deriv" && streamConfig.data.supportsStreaming
      ? streamConfig.data.providerSymbol
      : null,
  );

  const candles = useQuery({
    queryKey: ["trading_candles_live", instrument?.id, selectedTimeframe],
    enabled: Boolean(instrument?.id),
    refetchInterval: 15_000,
    staleTime: 8_000,
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Authentication required for trading candles");

      try {
        const response = await fetch(
          `/api/trading-candles?instrumentId=${encodeURIComponent(instrument!.id)}&timeframe=${encodeURIComponent(selectedTimeframe)}`,
          { headers: { authorization: `Bearer ${token}` } },
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          candles?: Array<{
            openTime: string;
            closeTime: string;
            open: number;
            high: number;
            low: number;
            close: number;
          }>;
        };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Unable to load live Deriv candles");
        }
        if ((payload.candles ?? []).length > 0) {
          return payload.candles!.map((row) => ({
            ...row,
            label: new Date(row.openTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }));
        }
      } catch (liveError) {
        console.warn("Live Deriv candle history unavailable; using stored fallback", liveError);
      }

      const { data, error } = await supabase
        .from("market_candles")
        .select("open_time,close_time,open,high,low,close")
        .eq("instrument_id", instrument!.id)
        .eq("timeframe", selectedTimeframe)
        .eq("is_closed", true)
        .order("open_time", { ascending: false })
        .limit(720);
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

  const executableEvidence =
    activeOpportunity &&
    activeOpportunity.qualified &&
    (activeOpportunity.direction === "buy" || activeOpportunity.direction === "sell")
      ? activeOpportunity
      : null;
  const demoAccount = selectedAccount?.account_environment === "demo";
  const demoEvidenceLocked = Boolean(demoAccount && executableEvidence);
  const ticketSide: "buy" | "sell" =
    demoEvidenceLocked && executableEvidence ? executableEvidence.direction : side;
  const ticketEntry = demoAccount ? String(executableEvidence?.entry ?? "") : entry;
  const ticketStopLoss = demoAccount ? String(executableEvidence?.stopLoss ?? "") : stopLoss;
  const ticketTakeProfit = demoAccount ? String(executableEvidence?.takeProfit1 ?? "") : takeProfit;
  const chartEntry = demoAccount
    ? executableEvidence?.entry ?? null
    : Number(entry) || activeOpportunity?.entry || null;
  const chartStopLoss = demoAccount
    ? executableEvidence?.stopLoss ?? null
    : Number(stopLoss) || activeOpportunity?.stopLoss || null;
  const chartTakeProfit = demoAccount
    ? executableEvidence?.takeProfit1 ?? null
    : Number(takeProfit) || activeOpportunity?.takeProfit1 || null;

  function selectInstrument(nextSymbol: string) {
    setSymbol(nextSymbol);
    setTimeframe("");
    setEntry("");
    setStopLoss("");
    setTakeProfit("");
    setResult(null);
  }

  function selectTimeframe(next: string) {
    setTimeframe(next);
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
    if (demoAccount && !executableEvidence) {
      setResult({
        ok: false,
        message:
          "Demo execution requires a current qualified BUY/SELL Cossa evidence set for this instrument and timeframe.",
      });
      return;
    }

    const requestedEntry = Number(
      demoAccount ? executableEvidence?.entry : entry || executableEvidence?.entry || currentPrice,
    );
    const requestedAmount = Number(amount);
    const sl = Number(
      demoAccount ? executableEvidence?.stopLoss : stopLoss || executableEvidence?.stopLoss,
    );
    const tp = Number(
      demoAccount ? executableEvidence?.takeProfit1 : takeProfit || executableEvidence?.takeProfit1,
    );

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
          side: ticketSide,
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
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Order submission failed");

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

  const demoExecutable = Boolean(executableEvidence);

  const ticket = (
    <OrderTicket
      selectedAccount={selectedAccount}
      demoAccount={Boolean(demoAccount)}
      demoExecutable={demoExecutable}
      demoEvidenceLocked={demoEvidenceLocked}
      ticketSide={ticketSide}
      amount={amount}
      setAmount={setAmount}
      ticketEntry={ticketEntry}
      ticketStopLoss={ticketStopLoss}
      ticketTakeProfit={ticketTakeProfit}
      setEntry={setEntry}
      setStopLoss={setStopLoss}
      setTakeProfit={setTakeProfit}
      setSide={setSide}
      submitting={submitting}
      instrumentReady={Boolean(instrument)}
      result={result}
      onSubmit={() => void submitOrder()}
    />
  );

  const analysis = (
    <div className="grid gap-2 lg:grid-cols-2">
      <section className="rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Cossa analysis</h2>
        </div>
        {activeOpportunity ? (
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <p><span className="text-muted-foreground">Decision</span><br/><strong className="uppercase">{activeOpportunity.direction.replace("_", " ")}</strong> · {activeOpportunity.confidenceScore}%</p>
            <p><span className="text-muted-foreground">Data / R:R</span><br/><strong>{activeOpportunity.dataConfidenceScore ?? "—"}%</strong> · {activeOpportunity.riskRewardRatio?.toFixed(2) ?? "—"}</p>
            <p><span className="text-muted-foreground">Structure</span><br/>{activeOpportunity.structure?.trend ?? "unavailable"} · {activeOpportunity.structure?.breakout ?? "—"}</p>
            <p><span className="text-muted-foreground">Regime</span><br/>{activeOpportunity.regime}</p>
            {!activeOpportunity.qualified ? (
              <p className="sm:col-span-2 text-caution">Not executable: {activeOpportunity.qualificationReasons.slice(0, 2).join(" · ")}</p>
            ) : null}
            {demoEvidenceLocked ? (
              <p className="sm:col-span-2 inline-flex items-center gap-1.5 text-primary"><LockKeyhole className="size-3.5" /> Qualified plan auto-loaded into Demo ticket</p>
            ) : activeOpportunity.direction === "buy" || activeOpportunity.direction === "sell" ? (
              <button type="button" onClick={loadEvidencePlan} className="sm:col-span-2 w-fit rounded-md border border-border-gold px-3 py-2 text-xs font-medium text-primary">Load current evidence into order ticket</button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No current Cossa evidence for this instrument/timeframe yet.</p>
        )}
      </section>

      <section className="rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2"><WalletCards className="size-4 text-primary"/><h2 className="text-sm font-semibold">Account state</h2></div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <p>Environment<br/><strong className="text-foreground">{selectedAccount?.account_environment?.toUpperCase() ?? "Not configured"}</strong></p>
          <p>Provider<br/><strong className="text-foreground">{selectedAccount?.provider ?? "—"}</strong></p>
          <p>Mode<br/><strong className="text-foreground">{selectedAccount?.execution_mode ?? "—"}</strong></p>
          <p>Emergency stop<br/><strong className="text-foreground">{selectedAccount?.emergency_stop ? "ACTIVE" : "Clear"}</strong></p>
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-2">
        <div className="min-w-[190px]">
          <select className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground" value={selectedSymbol} onChange={(event) => selectInstrument(event.target.value)}>
            {tradable.map((item) => <option key={item.id} value={item.symbol}>{item.display_name} · LIVE</option>)}
          </select>
        </div>

        <div className="flex items-center gap-0.5 overflow-x-auto rounded-md border border-border bg-background p-0.5">
          {TIMEFRAMES.map((value) => (
            <button key={value} type="button" onClick={() => selectTimeframe(value)} className={cn("rounded px-2.5 py-1 text-[11px] font-medium", selectedTimeframe === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{value.toUpperCase()}</button>
          ))}
        </div>

        <select className="min-w-[160px] rounded-md border bg-background px-2 py-1.5 text-xs text-foreground" value={selectedAccount?.id ?? ""} onChange={(event) => { setAccountId(event.target.value); setResult(null); }}>
          {(accounts.data ?? []).length === 0 ? <option value="">No trading account</option> : null}
          {(accounts.data ?? []).map((account) => <option key={account.id} value={account.id}>{account.account_label} · {account.account_environment.toUpperCase()}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton label="Split" active={layoutMode === "split"} onClick={() => setLayoutMode("split")}><Columns3 className="size-3.5" /></ToolbarButton>
          <ToolbarButton label="Ticket below" active={layoutMode === "ticket-below"} onClick={() => setLayoutMode("ticket-below")}><Rows3 className="size-3.5" /></ToolbarButton>
          <ToolbarButton label="Chart focus" active={layoutMode === "focus"} onClick={() => setLayoutMode("focus")}><Square className="size-3.5" /></ToolbarButton>
          <ToolbarButton label="Market watch" active={showMarketWatch} onClick={() => setShowMarketWatch((value) => !value)}><PanelRight className="size-3.5" /></ToolbarButton>
          <ToolbarButton label="Terminal" active={showTerminalDock} onClick={() => setShowTerminalDock((value) => !value)}><TerminalSquare className="size-3.5" /></ToolbarButton>
        </div>
      </div>

      {rejectedDeepLink ? (
        <div className="rounded-md border border-caution/40 bg-caution/5 px-3 py-2 text-xs text-caution">
          {search.symbol} is not available through the verified live Deriv execution feed. The terminal opened {selectedSymbol || "the next verified live market"} instead.
        </div>
      ) : null}

      {!accounts.isLoading && (accounts.data ?? []).length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-gold/50 bg-card p-3">
          <div><p className="text-sm font-semibold">Demo account required</p><p className="text-xs text-muted-foreground">Create the virtual Deriv Demo account so the risk engine has a balance and daily baseline.</p></div>
          <Link to="/demo-setup" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Set up Demo account</Link>
        </div>
      ) : null}

      <div className={cn("grid gap-2", showMarketWatch && layoutMode !== "focus" ? "2xl:grid-cols-[minmax(0,1fr)_285px]" : "grid-cols-1")}>
        <div className="min-w-0 space-y-2">
          {layoutMode === "split" ? (
            <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(0,1fr)_330px]">
              <div className="min-w-0"><MarketExecutionChart symbol={selectedSymbol || "Market"} timeframe={selectedTimeframe} data={candles.data ?? []} currentPrice={currentPrice} liveEpoch={liveTick.epoch} liveConnected={liveTick.connected} liveReceivedAtMs={liveTick.receivedAtMs} bid={liveTick.bid} ask={liveTick.ask} entryPrice={chartEntry} stopLoss={chartStopLoss} takeProfit1={chartTakeProfit} /></div>
              {ticket}
            </div>
          ) : (
            <MarketExecutionChart symbol={selectedSymbol || "Market"} timeframe={selectedTimeframe} data={candles.data ?? []} currentPrice={currentPrice} liveEpoch={liveTick.epoch} liveConnected={liveTick.connected} liveReceivedAtMs={liveTick.receivedAtMs} bid={liveTick.bid} ask={liveTick.ask} entryPrice={chartEntry} stopLoss={chartStopLoss} takeProfit1={chartTakeProfit} />
          )}

          {streamConfig.data?.provider === "deriv" && liveTick.error ? (
            <div className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">Live Deriv stream: {liveTick.error}</div>
          ) : null}
          {candles.isError ? (
            <div className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">Candle history: {candles.error instanceof Error ? candles.error.message : "Unable to load this timeframe"}</div>
          ) : candles.isFetched && (candles.data ?? []).length === 0 ? (
            <div className="rounded-md border border-caution/40 p-2 text-xs text-caution">No verified {selectedTimeframe} candle history is currently available for {selectedSymbol || "this instrument"}. The terminal will retry automatically.</div>
          ) : null}

          {layoutMode !== "focus" ? analysis : null}
          {layoutMode === "ticket-below" ? ticket : null}
        </div>

        {showMarketWatch && layoutMode !== "focus" ? (
          <MarketWatchPanel
            markets={tradable.map((item) => ({ id: item.id, symbol: item.symbol, displayName: item.display_name, category: item.category, assetClass: item.asset_class, currentPrice: item.current_price, lastDataAt: item.last_data_at }))}
            selectedSymbol={selectedSymbol}
            opportunities={currentEvidence}
            selectedLive={{ price: liveTick.price, connected: liveTick.connected, receivedAtMs: liveTick.receivedAtMs }}
            onSelect={selectInstrument}
          />
        ) : null}
      </div>

      {showTerminalDock && layoutMode !== "focus" ? (
        <TradingTerminalDock opportunities={currentEvidence} liveConnected={liveTick.connected} symbol={selectedSymbol} timeframe={selectedTimeframe} streamError={liveTick.error} executionMessage={result} />
      ) : null}

      {layoutMode === "focus" ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span>Chart Focus hides execution panels but does not change server execution state.</span>
          <button type="button" onClick={() => setLayoutMode("ticket-below")} className="text-primary">Restore workstation</button>
        </div>
      ) : null}
    </div>
  );
}

function ToolbarButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={cn("rounded-md border p-2 transition-colors", active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{children}</button>;
}

function OrderTicket({
  selectedAccount,
  demoAccount,
  demoExecutable,
  demoEvidenceLocked,
  ticketSide,
  amount,
  setAmount,
  ticketEntry,
  ticketStopLoss,
  ticketTakeProfit,
  setEntry,
  setStopLoss,
  setTakeProfit,
  setSide,
  submitting,
  instrumentReady,
  result,
  onSubmit,
}: {
  selectedAccount: any;
  demoAccount: boolean;
  demoExecutable: boolean;
  demoEvidenceLocked: boolean;
  ticketSide: "buy" | "sell";
  amount: string;
  setAmount: (value: string) => void;
  ticketEntry: string;
  ticketStopLoss: string;
  ticketTakeProfit: string;
  setEntry: (value: string) => void;
  setStopLoss: (value: string) => void;
  setTakeProfit: (value: string) => void;
  setSide: (value: "buy" | "sell") => void;
  submitting: boolean;
  instrumentReady: boolean;
  result: { ok: boolean; message: string } | null;
  onSubmit: () => void;
}) {
  return (
    <aside className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold">Order ticket</h2><p className="mt-0.5 text-[10px] text-muted-foreground">Qualified Cossa evidence + fresh server-side Deriv tick.</p></div>
        {demoEvidenceLocked ? <span className="inline-flex items-center gap-1 rounded-full border border-border-gold/50 px-2 py-1 text-[9px] font-semibold uppercase text-primary"><LockKeyhole className="size-3"/> Evidence locked</span> : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={demoAccount} onClick={() => setSide("buy")} className={cn("rounded-md border p-2.5 text-xs font-semibold disabled:cursor-not-allowed", ticketSide === "buy" ? "border-primary text-primary" : "border-border", demoAccount && ticketSide !== "buy" && "opacity-40")}>BUY</button>
        <button type="button" disabled={demoAccount} onClick={() => setSide("sell")} className={cn("rounded-md border p-2.5 text-xs font-semibold disabled:cursor-not-allowed", ticketSide === "sell" ? "border-primary text-primary" : "border-border", demoAccount && ticketSide !== "sell" && "opacity-40")}>SELL</button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <label className="block text-[11px] text-muted-foreground">Amount / size<input type="number" step="any" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-xs text-foreground"/></label>
        <TicketPlanField label="Entry" value={ticketEntry} locked={demoAccount} onChange={setEntry}/>
        <TicketPlanField label="Stop loss" value={ticketStopLoss} locked={demoAccount} onChange={setStopLoss}/>
        <TicketPlanField label="Take profit" value={ticketTakeProfit} locked={demoAccount} onChange={setTakeProfit}/>
      </div>
      <div className="mt-3 rounded-md border border-border p-2 text-[10px] text-muted-foreground">
        {!selectedAccount ? "No trading account configured." : selectedAccount.account_environment === "live" ? "LIVE account: submission creates an order awaiting explicit confirmation." : demoExecutable ? `DEMO: Cossa ${ticketSide.toUpperCase()} plan is locked; only size is editable. Server re-qualifies evidence and confirms a fresh Deriv tick.` : "DEMO: current evidence is WAIT/REJECTED or missing. Execution fails closed."}
      </div>
      {!selectedAccount ? (
        <Link to="/demo-setup" className="mt-3 flex w-full justify-center rounded-md border border-border-gold px-4 py-2.5 text-xs font-semibold text-primary">Set up Demo account</Link>
      ) : (
        <button type="button" disabled={submitting || !instrumentReady || selectedAccount.emergency_stop || (demoAccount && !demoExecutable)} onClick={onSubmit} className="mt-3 w-full rounded-md bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Submitting…" : `Submit ${ticketSide.toUpperCase()}`}</button>
      )}
      {result ? <div className={cn("mt-2 rounded-md border p-2 text-[10px]", result.ok ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive")}>{result.message}</div> : null}
    </aside>
  );
}

function TicketPlanField({ label, value, locked, onChange }: { label: string; value: string; locked: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block text-[11px] text-muted-foreground">
      <span className="flex items-center justify-between gap-2">{label}{locked ? <span className="text-[9px] uppercase text-primary">Cossa evidence</span> : null}</span>
      <input type="number" step="any" value={value} disabled={locked} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-80"/>
    </label>
  );
}
