import { supabaseAdmin } from "../../integrations/supabase/client.server";

function positive(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive number`);
  return parsed;
}

export async function bootstrapDemoTradingAccount(input: {
  userId: string;
  startingBalance: number;
  currency?: string;
}) {
  const startingBalance = positive(input.startingBalance, "starting balance");
  const currency = (input.currency || "USD").trim().toUpperCase();

  const existing = await supabaseAdmin
    .from("trading_accounts")
    .select("id")
    .eq("user_id", input.userId)
    .eq("provider", "deriv")
    .eq("account_environment", "demo")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(`Unable to inspect demo account: ${existing.error.message}`);

  let accountId = existing.data?.id ?? null;
  if (accountId) {
    const { error } = await supabaseAdmin
      .from("trading_accounts")
      .update({
        account_label: "Deriv Demo",
        execution_mode: "paper_auto",
        enabled: true,
        currency,
        emergency_stop: false,
      })
      .eq("id", accountId)
      .eq("user_id", input.userId);
    if (error) throw new Error(`Unable to update demo account: ${error.message}`);
  } else {
    const { data, error } = await supabaseAdmin
      .from("trading_accounts")
      .insert({
        user_id: input.userId,
        provider: "deriv",
        provider_account_ref: null,
        account_label: "Deriv Demo",
        account_environment: "demo",
        execution_mode: "paper_auto",
        enabled: true,
        currency,
        max_risk_per_trade_pct: 1,
        max_daily_loss_pct: 3,
        max_open_positions: 3,
        emergency_stop: false,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Unable to create demo account: ${error?.message ?? "missing account"}`);
    accountId = data.id;
  }

  const { count, error: snapshotCountError } = await supabaseAdmin
    .from("trading_account_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("trading_account_id", accountId);
  if (snapshotCountError) throw new Error(`Unable to inspect demo balance: ${snapshotCountError.message}`);

  if (!count) {
    const { error } = await supabaseAdmin.from("trading_account_snapshots").insert({
      trading_account_id: accountId,
      equity: startingBalance,
      balance: startingBalance,
      available_balance: startingBalance,
      currency,
      open_positions: 0,
      provider_timestamp: new Date().toISOString(),
      metadata: { source: "cossa_demo_bootstrap", virtual_funds: true, starting_balance: startingBalance },
    });
    if (error) throw new Error(`Unable to seed demo balance: ${error.message}`);
  }

  await refreshDemoRiskState(accountId, input.userId);
  return { accountId, startingBalance, currency };
}

export async function refreshDemoRiskState(accountId: string, userId: string) {
  const accountResult = await supabaseAdmin
    .from("trading_accounts")
    .select("id,user_id,account_environment,currency")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();
  if (accountResult.error || !accountResult.data) throw new Error("Demo trading account was not found");
  if (accountResult.data.account_environment !== "demo") throw new Error("Demo risk state cannot refresh a live account");

  const firstSnapshot = await supabaseAdmin
    .from("trading_account_snapshots")
    .select("balance,currency")
    .eq("trading_account_id", accountId)
    .order("captured_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstSnapshot.error || !firstSnapshot.data) throw new Error("Demo account has no starting balance");

  const now = new Date();
  const tradingDate = now.toISOString().slice(0, 10);
  const start = `${tradingDate}T00:00:00.000Z`;
  const end = `${tradingDate}T23:59:59.999Z`;

  const openPositions = await supabaseAdmin
    .from("execution_positions")
    .select("unrealized_pnl")
    .eq("trading_account_id", accountId)
    .in("status", ["opening", "open", "closing"]);
  if (openPositions.error) throw new Error(`Unable to inspect open positions: ${openPositions.error.message}`);

  const closedPositions = await supabaseAdmin
    .from("execution_positions")
    .select("realized_pnl")
    .eq("trading_account_id", accountId)
    .eq("status", "closed")
    .gte("closed_at", start)
    .lte("closed_at", end);
  if (closedPositions.error) throw new Error(`Unable to inspect closed positions: ${closedPositions.error.message}`);

  const baseBalance = positive(firstSnapshot.data.balance, "demo base balance");
  const realizedPnl = (closedPositions.data ?? []).reduce((sum, row) => sum + Number(row.realized_pnl ?? 0), 0);
  const unrealizedPnl = (openPositions.data ?? []).reduce((sum, row) => sum + Number(row.unrealized_pnl ?? 0), 0);
  const balance = baseBalance + realizedPnl;
  const equity = balance + unrealizedPnl;
  if (!Number.isFinite(equity) || equity <= 0) throw new Error("Demo equity is invalid; execution fails closed");

  const currency = accountResult.data.currency || firstSnapshot.data.currency || "USD";
  const { error: snapshotError } = await supabaseAdmin.from("trading_account_snapshots").insert({
    trading_account_id: accountId,
    equity,
    balance,
    available_balance: balance,
    currency,
    open_positions: (openPositions.data ?? []).length,
    provider_timestamp: now.toISOString(),
    metadata: { source: "cossa_demo_risk_refresh", virtual_funds: true, realized_pnl: realizedPnl, unrealized_pnl: unrealizedPnl },
  });
  if (snapshotError) throw new Error(`Unable to refresh demo account snapshot: ${snapshotError.message}`);

  const daily = await supabaseAdmin
    .from("trading_daily_risk_state")
    .upsert(
      {
        trading_account_id: accountId,
        trading_date: tradingDate,
        start_of_day_equity: baseBalance,
        realized_pnl: realizedPnl,
        peak_equity: Math.max(baseBalance, equity),
        lowest_equity: Math.min(baseBalance, equity),
        trades_opened: (openPositions.data ?? []).length + (closedPositions.data ?? []).length,
        trades_closed: (closedPositions.data ?? []).length,
        loss_limit_triggered: false,
      },
      { onConflict: "trading_account_id,trading_date" },
    )
    .select("id")
    .single();
  if (daily.error || !daily.data) throw new Error(`Unable to refresh daily risk state: ${daily.error?.message ?? "missing row"}`);

  return { accountId, equity, balance, realizedPnl, unrealizedPnl, openPositions: (openPositions.data ?? []).length, tradingDate };
}
