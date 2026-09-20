import { supabaseAdmin } from "../../integrations/supabase/client.server";

function positive(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${label} must be a positive number`);
  return parsed;
}

function normalizeIdempotencyKey(value: string) {
  const key = value.trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw new Error("Invalid demo top up idempotency key");
  }
  return key;
}

async function findDemoFundingEvent(accountId: string, userId: string, idempotencyKey: string) {
  const result = await supabaseAdmin
    .from("demo_funding_events")
    .select("id,amount,currency,metadata")
    .eq("trading_account_id", accountId)
    .eq("user_id", userId)
    .contains("metadata", { idempotency_key: idempotencyKey })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error(`Unable to inspect demo top up: ${result.error.message}`);
  return result.data;
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
  if (existing.error)
    throw new Error(`Unable to inspect demo account: ${existing.error.message}`);

  let accountId = existing.data?.id ?? null;
  if (accountId) {
    const { error } = await supabaseAdmin
      .from("trading_accounts")
      .update({
        account_label: "Deriv Demo",
        execution_mode: "paper_auto",
        enabled: true,
        currency,
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
    if (error || !data)
      throw new Error(`Unable to create demo account: ${error?.message ?? "missing account"}`);
    accountId = data.id;
  }

  const { count, error: snapshotCountError } = await supabaseAdmin
    .from("trading_account_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("trading_account_id", accountId);
  if (snapshotCountError)
    throw new Error(`Unable to inspect demo balance: ${snapshotCountError.message}`);

  if (!count) {
    const { error } = await supabaseAdmin.from("trading_account_snapshots").insert({
      trading_account_id: accountId,
      equity: startingBalance,
      balance: startingBalance,
      available_balance: startingBalance,
      currency,
      open_positions: 0,
      provider_timestamp: new Date().toISOString(),
      metadata: {
        source: "cossa_demo_bootstrap",
        virtual_funds: true,
        starting_balance: startingBalance,
      },
    });
    if (error) throw new Error(`Unable to seed demo balance: ${error.message}`);
  }

  await refreshDemoRiskState(accountId, input.userId);
  return { accountId, startingBalance, currency };
}

export async function topUpDemoTradingAccount(input: {
  accountId: string;
  userId: string;
  amount: number;
  idempotencyKey: string;
}) {
  const amount = positive(input.amount, "top up amount");
  if (amount > 1_000_000) throw new Error("Demo top up cannot exceed 1,000,000 per request");
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  const account = await supabaseAdmin
    .from("trading_accounts")
    .select("id,user_id,account_environment,currency,enabled")
    .eq("id", input.accountId)
    .eq("user_id", input.userId)
    .single();
  if (account.error || !account.data) throw new Error("Trading account was not found");
  if (account.data.account_environment !== "demo") throw new Error("Only demo accounts can receive virtual top ups");
  if (!account.data.enabled) throw new Error("Demo account is disabled");

  let replayed = false;
  let existing = await findDemoFundingEvent(input.accountId, input.userId, idempotencyKey);
  if (existing) {
    if (Number(existing.amount) !== amount) {
      throw new Error("Demo top up idempotency key was already used for a different amount");
    }
    replayed = true;
  } else {
    const { error } = await supabaseAdmin.from("demo_funding_events").insert({
      trading_account_id: input.accountId,
      user_id: input.userId,
      event_type: "top_up",
      amount,
      currency: account.data.currency || "ZAR",
      metadata: {
        source: "cossa_demo_top_up",
        virtual_funds: true,
        idempotency_key: idempotencyKey,
      },
    });
    if (error) {
      if (error.code !== "23505") {
        throw new Error(`Unable to record demo top up: ${error.message}`);
      }
      existing = await findDemoFundingEvent(input.accountId, input.userId, idempotencyKey);
      if (!existing || Number(existing.amount) !== amount) {
        throw new Error("Unable to reconcile duplicate demo top up request");
      }
      replayed = true;
    }
  }

  const state = await refreshDemoRiskState(input.accountId, input.userId);
  return { ...state, topUpAmount: amount, replayed, idempotencyKey };
}

export async function refreshDemoRiskState(accountId: string, userId: string) {
  const accountResult = await supabaseAdmin
    .from("trading_accounts")
    .select("id,user_id,account_environment,currency")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();
  if (accountResult.error || !accountResult.data)
    throw new Error("Demo trading account was not found");
  if (accountResult.data.account_environment !== "demo")
    throw new Error("Demo risk state cannot refresh a live account");

  const firstSnapshot = await supabaseAdmin
    .from("trading_account_snapshots")
    .select("balance,currency")
    .eq("trading_account_id", accountId)
    .order("captured_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstSnapshot.error || !firstSnapshot.data)
    throw new Error("Demo account has no starting balance");

  const now = new Date();
  const tradingDate = now.toISOString().slice(0, 10);
  const start = `${tradingDate}T00:00:00.000Z`;
  const end = `${tradingDate}T23:59:59.999Z`;

  const [openPositions, allClosedPositions, todayClosedPositions, fundingEvents, existingDaily] =
    await Promise.all([
      supabaseAdmin
        .from("execution_positions")
        .select("unrealized_pnl")
        .eq("trading_account_id", accountId)
        .in("status", ["opening", "open", "closing"]),
      supabaseAdmin
        .from("execution_positions")
        .select("realized_pnl")
        .eq("trading_account_id", accountId)
        .eq("status", "closed"),
      supabaseAdmin
        .from("execution_positions")
        .select("realized_pnl")
        .eq("trading_account_id", accountId)
        .eq("status", "closed")
        .gte("closed_at", start)
        .lte("closed_at", end),
      supabaseAdmin
        .from("demo_funding_events")
        .select("amount,event_type")
        .eq("trading_account_id", accountId)
        .eq("user_id", userId),
      supabaseAdmin
        .from("trading_daily_risk_state")
        .select(
          "start_of_day_equity,peak_equity,lowest_equity,loss_limit_triggered,trades_opened,trades_closed",
        )
        .eq("trading_account_id", accountId)
        .eq("trading_date", tradingDate)
        .maybeSingle(),
    ]);

  if (openPositions.error)
    throw new Error(`Unable to inspect open positions: ${openPositions.error.message}`);
  if (allClosedPositions.error)
    throw new Error(`Unable to inspect closed positions: ${allClosedPositions.error.message}`);
  if (todayClosedPositions.error)
    throw new Error(`Unable to inspect daily closed positions: ${todayClosedPositions.error.message}`);
  if (fundingEvents.error)
    throw new Error(`Unable to inspect demo funding: ${fundingEvents.error.message}`);
  if (existingDaily.error)
    throw new Error(`Unable to inspect daily risk state: ${existingDaily.error.message}`);

  const startingBalance = positive(firstSnapshot.data.balance, "demo starting balance");
  const fundedAmount = (fundingEvents.data ?? []).reduce(
    (sum, row) => sum + (row.event_type === "top_up" ? Number(row.amount ?? 0) : 0),
    0,
  );
  const lifetimeRealizedPnl = (allClosedPositions.data ?? []).reduce(
    (sum, row) => sum + Number(row.realized_pnl ?? 0),
    0,
  );
  const dailyRealizedPnl = (todayClosedPositions.data ?? []).reduce(
    (sum, row) => sum + Number(row.realized_pnl ?? 0),
    0,
  );
  const unrealizedPnl = (openPositions.data ?? []).reduce(
    (sum, row) => sum + Number(row.unrealized_pnl ?? 0),
    0,
  );
  const fundedBaseBalance = startingBalance + fundedAmount;
  const balance = fundedBaseBalance + lifetimeRealizedPnl;
  const equity = balance + unrealizedPnl;
  if (!Number.isFinite(equity) || equity <= 0)
    throw new Error("Demo equity is invalid; execution fails closed");

  const currency = accountResult.data.currency || firstSnapshot.data.currency || "USD";
  const { error: snapshotError } = await supabaseAdmin.from("trading_account_snapshots").insert({
    trading_account_id: accountId,
    equity,
    balance,
    available_balance: balance,
    currency,
    open_positions: (openPositions.data ?? []).length,
    provider_timestamp: now.toISOString(),
    metadata: {
      source: "cossa_demo_risk_refresh",
      virtual_funds: true,
      starting_balance: startingBalance,
      funded_amount: fundedAmount,
      realized_pnl: lifetimeRealizedPnl,
      unrealized_pnl: unrealizedPnl,
    },
  });
  if (snapshotError)
    throw new Error(`Unable to refresh demo account snapshot: ${snapshotError.message}`);

  const startOfDayEquity = Number(existingDaily.data?.start_of_day_equity ?? equity - dailyRealizedPnl);
  const previousPeak = Number(existingDaily.data?.peak_equity ?? startOfDayEquity);
  const previousLow = Number(existingDaily.data?.lowest_equity ?? startOfDayEquity);
  const tradesClosed = Math.max(
    Number(existingDaily.data?.trades_closed ?? 0),
    (todayClosedPositions.data ?? []).length,
  );
  const tradesOpened = Math.max(
    Number(existingDaily.data?.trades_opened ?? 0),
    (openPositions.data ?? []).length + tradesClosed,
  );

  const daily = await supabaseAdmin
    .from("trading_daily_risk_state")
    .upsert(
      {
        trading_account_id: accountId,
        trading_date: tradingDate,
        start_of_day_equity: startOfDayEquity,
        realized_pnl: dailyRealizedPnl,
        peak_equity: Math.max(previousPeak, equity),
        lowest_equity: Math.min(previousLow, equity),
        trades_opened: tradesOpened,
        trades_closed: tradesClosed,
        loss_limit_triggered: Boolean(existingDaily.data?.loss_limit_triggered),
      },
      { onConflict: "trading_account_id,trading_date" },
    )
    .select("id")
    .single();
  if (daily.error || !daily.data)
    throw new Error(
      `Unable to refresh daily risk state: ${daily.error?.message ?? "missing row"}`,
    );

  return {
    accountId,
    equity,
    balance,
    fundedAmount,
    realizedPnl: lifetimeRealizedPnl,
    unrealizedPnl,
    openPositions: (openPositions.data ?? []).length,
    tradingDate,
  };
}
