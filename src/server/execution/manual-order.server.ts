import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "../../integrations/supabase/client.server";

export type ManualOrderIntent = {
  userId: string;
  tradingAccountId: string;
  instrumentId: string;
  side: "buy" | "sell";
  requestedAmount: number;
  requestedEntry: number;
  stopLoss: number;
  takeProfit1: number;
  signalId?: string | null;
  riskPct?: number | null;
};

function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number`);
  return value;
}

export async function createManualOrderIntent(input: ManualOrderIntent) {
  positive(input.requestedAmount, "requested amount");
  positive(input.requestedEntry, "requested entry");
  positive(input.stopLoss, "stop loss");
  positive(input.takeProfit1, "take profit");

  const { data: account, error: accountError } = await supabaseAdmin
    .from("trading_accounts")
    .select(
      "id,user_id,provider,account_environment,execution_mode,enabled,emergency_stop,currency",
    )
    .eq("id", input.tradingAccountId)
    .eq("user_id", input.userId)
    .single();
  if (accountError || !account) throw new Error("Trading account was not found");
  if (!account.enabled) throw new Error("Trading account is disabled");
  if (account.emergency_stop) throw new Error("Trading account emergency stop is active");

  let signalEvidence: {
    confidence: number;
    generatedAt: string;
    direction: string;
  } | null = null;

  if (input.signalId) {
    const { data: signal, error: signalError } = await supabaseAdmin
      .from("signals")
      .select("id,instrument_id,direction,confidence_score,data_timestamp,calculated_at,created_at")
      .eq("id", input.signalId)
      .eq("instrument_id", input.instrumentId)
      .single();
    if (signalError || !signal) throw new Error("Selected signal was not found for this instrument");

    const confidence = Number(signal.confidence_score ?? 0);
    const generatedAt = signal.data_timestamp ?? signal.calculated_at ?? signal.created_at;
    signalEvidence = {
      confidence,
      generatedAt,
      direction: String(signal.direction),
    };
  }

  const isDemo = account.account_environment === "demo";
  if (isDemo && !signalEvidence) {
    throw new Error("Demo auto execution requires a current Cossa signal so risk checks can verify confidence and freshness");
  }

  const executionMode = isDemo ? "paper_auto" : "live_manual";
  const confirmationRequired = !isDemo;
  const status = isDemo ? "approved" : "awaiting_confirmation";
  const idempotencyKey = `manual:${input.userId}:${input.tradingAccountId}:${randomUUID()}`;

  const { data: order, error } = await supabaseAdmin
    .from("execution_orders")
    .insert({
      user_id: input.userId,
      trading_account_id: input.tradingAccountId,
      signal_id: input.signalId ?? null,
      instrument_id: input.instrumentId,
      side: input.side,
      execution_mode: executionMode,
      status,
      requested_entry: input.requestedEntry,
      stop_loss: input.stopLoss,
      take_profit_1: input.takeProfit1,
      requested_amount: input.requestedAmount,
      requested_currency: account.currency,
      risk_pct: input.riskPct ?? null,
      idempotency_key: idempotencyKey,
      confirmation_required: confirmationRequired,
      metadata: {
        source: "cossa_trading_terminal",
        account_environment: account.account_environment,
        provider: account.provider,
        manual_ticket: true,
        confidence: signalEvidence?.confidence ?? null,
        generated_at: signalEvidence?.generatedAt ?? null,
        signal_direction: signalEvidence?.direction ?? null,
      },
    })
    .select("id,status,execution_mode,confirmation_required,created_at")
    .single();
  if (error || !order)
    throw new Error(`Unable to create execution order: ${error?.message ?? "missing order"}`);

  const { error: eventError } = await supabaseAdmin.from("execution_events").insert({
    order_id: order.id,
    event_type: isDemo ? "manual_demo_order_created" : "manual_live_order_created",
    old_status: null,
    new_status: status,
    payload: {
      source: "cossa_trading_terminal",
      account_environment: account.account_environment,
      confirmation_required: confirmationRequired,
      signal_confidence: signalEvidence?.confidence ?? null,
      signal_generated_at: signalEvidence?.generatedAt ?? null,
    },
  });
  if (eventError) throw new Error(`Unable to persist execution event: ${eventError.message}`);

  return order;
}
