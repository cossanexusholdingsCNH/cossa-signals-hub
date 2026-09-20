import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CircleDollarSign,
  RefreshCw,
  Trophy,
  WalletCards,
  X,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AccountState = {
  id: string;
  provider: string;
  account_label: string;
  account_environment: "demo" | "live" | string;
  execution_mode: string;
  currency: string;
  emergency_stop: boolean;
  balance: number;
  equity: number;
  availableBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  openPositions: number;
  closedTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;
  snapshotAt: string | null;
  providerTimestamp: string | null;
  virtualFunds: boolean;
};

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency || "ZAR",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency || "ZAR"} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }
}

function Stat({ label, value, emphasis }: { label: string; value: React.ReactNode; emphasis?: string }) {
  return (
    <div className="min-w-[92px] border-r border-border/70 px-3 last:border-r-0">
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xs font-semibold tabular-nums text-foreground", emphasis)}>{value}</div>
    </div>
  );
}

export function AccountBalanceStrip({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("1000");
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [topUpMessage, setTopUpMessage] = useState<string | null>(null);
  const [topUpRequestKey, setTopUpRequestKey] = useState<string | null>(null);

  const accountState = useQuery({
    queryKey: ["account-state", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: 10_000,
    staleTime: 5_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const response = await fetch("/api/account-state", {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        account?: AccountState | null;
      };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to load account state");
      return payload.account ?? null;
    },
  });

  const account = accountState.data;
  if (!user) return null;

  async function topUpDemo() {
    if (!account || account.account_environment !== "demo") return;
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTopUpMessage("Enter a positive demo amount.");
      return;
    }
    const idempotencyKey = topUpRequestKey ?? crypto.randomUUID();
    if (!topUpRequestKey) setTopUpRequestKey(idempotencyKey);
    setTopUpBusy(true);
    setTopUpMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication required");
      const response = await fetch("/api/demo-funds", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ accountId: account.id, amount, idempotencyKey }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Demo top up failed");
      await accountState.refetch();
      setTopUpRequestKey(null);
      setTopUpMessage(`Added ${money(amount, account.currency)} virtual funds.`);
      setShowTopUp(false);
    } catch (error) {
      setTopUpMessage(error instanceof Error ? error.message : "Demo top up failed");
    } finally {
      setTopUpBusy(false);
    }
  }

  if (accountState.isLoading) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-card/60 px-3 text-[10px] text-muted-foreground">
        <RefreshCw className="size-3 animate-spin" /> Loading trading account…
      </div>
    );
  }

  if (!account) {
    return (
      <Link
        to="/demo-setup"
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border-gold/60 bg-primary/5 px-3 text-[11px] font-medium text-primary hover:bg-primary/10"
      >
        <WalletCards className="size-3.5" /> Set up trading account
      </Link>
    );
  }

  const pnlClass =
    account.totalPnl > 0
      ? "text-success"
      : account.totalPnl < 0
        ? "text-destructive"
        : "text-muted-foreground";
  const environment = account.account_environment === "demo" ? "DEMO" : "LIVE";

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex min-w-0 items-center rounded-md border border-border bg-card/70",
          compact ? "h-10" : "min-h-11",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-3">
          <CircleDollarSign className="size-4 text-primary" />
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
              {account.account_label}
              <span
                className={cn(
                  "rounded border px-1 py-0.5 text-[8px]",
                  environment === "DEMO"
                    ? "border-primary/40 text-primary"
                    : "border-success/40 text-success",
                )}
              >
                {environment}
              </span>
            </div>
            <div className="text-[9px] text-muted-foreground">
              {account.execution_mode.replaceAll("_", " ")}
            </div>
          </div>
        </div>

        <div className="hidden min-w-0 items-center overflow-x-auto md:flex">
          <Stat label="Balance" value={money(account.balance, account.currency)} />
          <Stat label="Equity" value={money(account.equity, account.currency)} />
          <Stat label="Available" value={money(account.availableBalance, account.currency)} />
          <Stat label="Total P/L" value={money(account.totalPnl, account.currency)} emphasis={pnlClass} />
          <Stat label="Open" value={account.openPositions} />
          <Stat
            label="W / L"
            value={`${account.wins} / ${account.losses}`}
            emphasis={account.wins > account.losses ? "text-success" : undefined}
          />
          <Stat label="Win rate" value={account.closedTrades ? `${account.winRate.toFixed(1)}%` : "—"} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 px-2">
          {account.account_environment === "demo" ? (
            <button
              type="button"
              onClick={() => {
                setShowTopUp((value) => !value);
                setTopUpMessage(null);
              }}
              title="Add virtual funds to this demo account"
              className="inline-flex h-7 items-center gap-1 rounded border border-border-gold/50 px-2 text-[9px] font-semibold text-primary hover:bg-primary/10"
            >
              <ArrowDownToLine className="size-3" /> Top up demo
            </button>
          ) : (
            <Link
              to="/account"
              title="Provider-managed deposits and withdrawals"
              className="inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[9px] font-semibold text-foreground hover:border-border-gold"
            >
              <ArrowDownToLine className="size-3" /> Deposit
            </Link>
          )}
          <Link
            to="/performance"
            title="View trading performance"
            className="hidden h-7 items-center gap-1 rounded border border-border px-2 text-[9px] font-semibold text-muted-foreground hover:text-foreground lg:inline-flex"
          >
            <Trophy className="size-3" /> Results
          </Link>
          {account.account_environment === "live" ? (
            <Link
              to="/account"
              title="Provider-managed withdrawals"
              className="hidden h-7 items-center gap-1 rounded border border-border px-2 text-[9px] font-semibold text-muted-foreground hover:text-foreground xl:inline-flex"
            >
              <ArrowUpFromLine className="size-3" /> Withdraw
            </Link>
          ) : null}
        </div>
      </div>

      {showTopUp && account.account_environment === "demo" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border-gold/40 bg-card px-3 py-2 text-[10px]">
          <span className="font-medium text-foreground">Virtual demo top up</span>
          <span className="text-muted-foreground">{account.currency}</span>
          <input
            type="number"
            min="1"
            max="1000000"
            step="100"
            value={topUpAmount}
            disabled={topUpBusy}
            onChange={(event) => {
              setTopUpAmount(event.target.value);
              setTopUpRequestKey(null);
              setTopUpMessage(null);
            }}
            className="h-7 w-32 rounded border border-border bg-background px-2 tabular-nums text-foreground outline-none focus:border-border-gold disabled:opacity-60"
          />
          <button
            type="button"
            disabled={topUpBusy}
            onClick={() => void topUpDemo()}
            className="inline-flex h-7 items-center gap-1 rounded bg-primary px-2.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {topUpBusy ? <RefreshCw className="size-3 animate-spin" /> : <Check className="size-3" />}
            Add funds
          </button>
          <button
            type="button"
            onClick={() => setShowTopUp(false)}
            className="inline-flex size-7 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
            aria-label="Close demo top up"
          >
            <X className="size-3" />
          </button>
          <span className="text-muted-foreground">Virtual funds only — no real money is deposited.</span>
        </div>
      ) : null}

      {topUpMessage ? <div className="px-2 text-[10px] text-muted-foreground">{topUpMessage}</div> : null}
    </div>
  );
}
