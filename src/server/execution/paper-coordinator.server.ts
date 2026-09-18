import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { evaluateExecutionRisk } from "./risk-engine";

export type PaperExecutionRequest = {
  orderId: string;
  userId: string;
  minimumConfidence?: number;
  maximumSnapshotAgeMs?: number;
  maximumMarketDataAgeMs?: number;
  valuePerPriceUnit?: number;
  minimumPositionSize?: number;
  maximumPositionSize?: number;
  positionStep?: number;
  now?: Date;
};

export type PaperExecutionDecision = {
  orderId: string;
  approved: boolean;
  positionSize: number;
  riskCheckId: string;
  rejectionReasons: string[];
};

const OPEN_STATUSES = ["approved", "submitted", "filled", "partially_filled"] as const;

function requireFinitePositive(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${label} must be a positive number`);
  return parsed;
}

export async function evaluatePaperExecution(
  request: PaperExecutionRequest,
): Promise<PaperExecutionDecision> {
  const now = request.now ?? new Date();
  const maximumSnapshotAgeMs = request.maximumSnapshotAgeMs ?? 120_000;
  const maximumMarketDataAgeMs = request.maximumMarketDataAgeMs ?? 120_000;
  const minimumConfidence = request.minimumConfidence ?? 70;

  const orderResult = await supabaseAdmin
    .from("execution_orders")
    .select(
      "id,user_id,trading_account_id,instrument_id,execution_mode,status,requested_entry,stop_loss,risk_pct,idempotency_key,metadata,requested_amount",
    )
    .eq("id", request.orderId)
    .eq("user_id", request.userId)
    .single();
  if (orderResult.error || !orderResult.data) throw new Error("Execution order was not found");
  const order = orderResult.data;

  if (order.execution_mode !== "paper_auto")
    throw new Error("Only paper_auto orders can use the paper coordinator");
  if (order.status !== "approved")
    throw new Error(`Paper order is not awaiting risk execution: ${order.status}`);

  const accountResult = await supabaseAdmin
    .from("trading_accounts")
    .select(
      "id,user_id,account_environment,execution_mode,enabled,emergency_stop,max_risk_per_trade_pct,max_daily_loss_pct,max_open_positions",
    )
    .eq("id", order.trading_account_id)
    .eq("user_id", request.userId)
    .single();
  if (accountResult.error || !accountResult.data) throw new Error("Trading account was not found");
  const account = accountResult.data;
  if (account.account_environment !== "demo" || account.execution_mode !== "paper_auto") {
    throw new Error("Paper coordinator cannot operate on a live or non-paper account");
  }

  const snapshotResult = await supabaseAdmin
    .from("trading_account_snapshots")
    .select("equity,balance,open_positions,captured_at")
    .eq("trading_account_id", account.id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapshotResult.error || !snapshotResult.data)
    throw new Error("Missing account snapshot; execution fails closed");
  const snapshot = snapshotResult.data;
  const snapshotAgeMs = now.getTime() - new Date(snapshot.captured_at).getTime();
  if (snapshotAgeMs < 0 || snapshotAgeMs > maximumSnapshotAgeMs)
    throw new Error("Account snapshot is stale; execution fails closed");

  const tradingDate = now.toISOString().slice(0, 10);
  const dailyResult = await supabaseAdmin
    .from("trading_daily_risk_state")
    .select("start_of_day_equity,loss_limit_triggered")
    .eq("trading_account_id", account.id)
    .eq("trading_date", tradingDate)
    .maybeSingle();
  if (dailyResult.error || !dailyResult.data)
    throw new Error("Missing daily risk baseline; execution fails closed");

  const duplicateResult = await supabaseAdmin
    .from("execution_orders")
    .select("id")
    .eq("idempotency_key", order.idempotency_key)
    .neq("id", order.id)
    .limit(1);
  if (duplicateResult.error)
    throw new Error(`Duplicate-order check failed: ${duplicateResult.error.message}`);

  const openResult = await supabaseAdmin
    .from("execution_orders")
    .select("id", { count: "exact", head: true })
    .eq("trading_account_id", account.id)
    .in("status", [...OPEN_STATUSES]);
  if (openResult.error) throw new Error(`Open-position check failed: ${openResult.error.message}`);

  const metadata =
    order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
      ? order.metadata
      : {};
  const confidence = Number(metadata["confidence"] ?? 0);
  const marketGeneratedAt = metadata["generated_at"] ?? metadata["signal_generated_at"];
  const marketDataAgeMs =
    typeof marketGeneratedAt === "string"
      ? now.getTime() - new Date(marketGeneratedAt).getTime()
      : Number.POSITIVE_INFINITY;

  const decision = evaluateExecutionRisk({
    equity: requireFinitePositive(snapshot.equity, "equity"),
    balance: requireFinitePositive(snapshot.balance, "balance"),
    startOfDayEquity: requireFinitePositive(
      dailyResult.data.start_of_day_equity,
      "start-of-day equity",
    ),
    riskPct: Number(order.risk_pct ?? Math.min(1, Number(account.max_risk_per_trade_pct))),
    maxRiskPerTradePct: requireFinitePositive(account.max_risk_per_trade_pct, "max risk per trade"),
    maxDailyLossPct: requireFinitePositive(account.max_daily_loss_pct, "max daily loss"),
    maxOpenPositions: Number(account.max_open_positions),
    openPositions: Math.max(Number(snapshot.open_positions ?? 0), Number(openResult.count ?? 0)),
    entry: requireFinitePositive(order.requested_entry, "entry"),
    stopLoss: requireFinitePositive(order.stop_loss, "stop loss"),
    confidence,
    minimumConfidence,
    marketDataAgeMs,
    maximumMarketDataAgeMs,
    accountEnabled: Boolean(account.enabled),
    emergencyStop:
      Boolean(account.emergency_stop) || Boolean(dailyResult.data.loss_limit_triggered),
    duplicateOrder: Boolean(duplicateResult.data?.length),
    valuePerPriceUnit: request.valuePerPriceUnit,
    minimumPositionSize: request.minimumPositionSize,
    maximumPositionSize: request.maximumPositionSize,
    positionStep: request.positionStep,
  });

  const { data: riskRow, error: riskError } = await supabaseAdmin
    .from("execution_risk_checks")
    .insert({
      order_id: order.id,
      approved: decision.approved,
      account_enabled: decision.gates.accountEnabled,
      emergency_stop_clear: decision.gates.emergencyStopClear,
      daily_loss_gate_clear: decision.gates.dailyLossGateClear,
      open_position_gate_clear: decision.gates.openPositionGateClear,
      per_trade_risk_gate_clear: decision.gates.perTradeRiskGateClear,
      signal_quality_gate_clear: decision.gates.signalQualityGateClear,
      stale_data_gate_clear: decision.gates.staleDataGateClear,
      duplicate_order_gate_clear: decision.gates.duplicateOrderGateClear,
      checks: {
        ...decision.gates,
        positionSizeGateClear: decision.gates.positionSizeGateClear,
        equity: snapshot.equity,
        balance: snapshot.balance,
        startOfDayEquity: dailyResult.data.start_of_day_equity,
        dailyLossPct: decision.dailyLossPct,
        riskAmount: decision.riskAmount,
        stopDistance: decision.stopDistance,
        rawPositionSize: decision.rawPositionSize,
        positionSize: decision.positionSize,
        confidence,
        snapshotAgeMs,
        marketDataAgeMs,
      },
      rejection_reasons: decision.rejectionReasons,
    })
    .select("id")
    .single();
  if (riskError || !riskRow?.id)
    throw new Error(
      `Unable to persist execution risk check: ${riskError?.message ?? "missing id"}`,
    );

  const nextStatus: "submitted" | "rejected" = decision.approved ? "submitted" : "rejected";
  const { error: updateError } = await supabaseAdmin
    .from("execution_orders")
    .update({
      status: nextStatus,
      requested_amount: decision.approved ? decision.positionSize : order.requested_amount,
      risk_pct: decision.riskPct,
      rejection_reason: decision.approved ? null : decision.rejectionReasons.join("; "),
      submitted_at: decision.approved ? now.toISOString() : null,
      metadata: {
        ...metadata,
        risk_check_id: riskRow.id,
        risk_approved: decision.approved,
        calculated_position_size: decision.positionSize,
        paper_submission_only: true,
      },
    })
    .eq("id", order.id)
    .eq("status", "approved");
  if (updateError) throw new Error(`Unable to transition paper order: ${updateError.message}`);

  const { error: eventError } = await supabaseAdmin.from("execution_events").insert({
    order_id: order.id,
    event_type: decision.approved ? "paper_risk_approved" : "paper_risk_rejected",
    old_status: "approved",
    new_status: nextStatus,
    payload: {
      risk_check_id: riskRow.id,
      position_size: decision.positionSize,
      rejection_reasons: decision.rejectionReasons,
    },
  });
  if (eventError) throw new Error(`Unable to persist execution event: ${eventError.message}`);

  return {
    orderId: order.id,
    approved: decision.approved,
    positionSize: decision.positionSize,
    riskCheckId: riskRow.id,
    rejectionReasons: decision.rejectionReasons,
  };
}
