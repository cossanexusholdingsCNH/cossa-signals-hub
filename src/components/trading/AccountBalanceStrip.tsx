import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, CircleDollarSign, RefreshCw, Trophy, WalletCards } from "lucide-react";

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
      const payload = (await response.json()) as { ok?: boolean; error?: string; account?: AccountState | null };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to load account state");
      return payload.account ?? null;
    },
  });

  const account = accountState.data;
  if (!user) return null;

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

  const pnlClass = account.totalPnl > 0 ? "text-success" : account.totalPnl < 0 ? "text-destructive" : "text-muted-foreground";
  const environment = account.account_environment === "demo" ? "DEMO" : "LIVE";

  return (
    <div className={cn("flex min-w-0 items-center rounded-md border border-border bg-card/70", compact ? "h-10" : "min-h-11")}>
      <div className="flex shrink-0 items-center gap-2 px-3">
        <CircleDollarSign className="size-4 text-primary" />
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-foreground">
            {account.account_label}
            <span className={cn("rounded border px-1 py-0.5 text-[8px]", environment === "DEMO" ? "border-primary/40 text-primary" : "border-success/40 text-success")}>{environment}</span>
          </div>
          <div className="text-[9px] text-muted-foreground">{account.execution_mode.replaceAll("_", " ")}</div>
        </div>
      </div>

      <div className="hidden min-w-0 items-center overflow-x-auto md:flex">
        <Stat label="Balance" value={money(account.balance, account.currency)} />
        <Stat label="Equity" value={money(account.equity, account.currency)} />
        <Stat label="Available" value={money(account.availableBalance, account.currency)} />
        <Stat label="P/L" value={money(account.totalPnl, account.currency)} emphasis={pnlClass} />
        <Stat label="Open" value={account.openPositions} />
        <Stat label="W / L" value={`${account.wins} / ${account.losses}`} emphasis={account.wins > account.losses ? "text-success" : undefined} />
        <Stat label="Win rate" value={account.closedTrades ? `${account.winRate.toFixed(1)}%` : "—"} />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 px-2">
        {account.account_environment === "demo" ? (
          <Link
            to="/demo-setup"
            title="Manage virtual demo funds"
            className="inline-flex h-7 items-center gap-1 rounded border border-border-gold/50 px-2 text-[9px] font-semibold text-primary hover:bg-primary/10"
          >
            <ArrowDownToLine className="size-3" /> Demo funds
          </Link>
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
  );
}
