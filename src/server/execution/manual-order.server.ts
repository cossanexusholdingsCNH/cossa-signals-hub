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
  signalEvidenceId?: string | null;
  riskPct?: number | null;
};

function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number`);
  return value;
}

function dataConfidenceFromDiagnostics(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const diagnostics = value as Record<string, unknown>;
  const raw = diagnostics["data_confidence"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const score = Number((raw as Record<string, unknown>)["score"] ?? 0);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : 0;
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
    dataConfidence: number;
    generatedAt: string;
    dataTo: string | null;
    direction: string;
    timeframe: string;
    riskReward: number | null;
  } | null = null;

  if (input.signalEvidenceId) {
    const [{ data: evidence, error: evidenceError }, controls] = await Promise.all([
      supabaseAdmin
        .from("signal_evidence")
        .select(
          "id,instrument_id,direction,timeframe,confidence_score,data_confidence_score,risk_reward_ratio,generated_at,data_to,entry,stop_loss,take_profit_1,no_trade_reasons",
        )
        .eq("id", input.signalEvidenceId)
        .eq("instrument_id", input.instrumentId)
        .single(),
      supabaseAdmin
        .from("platform_controls")
        .select("scanner_min_signal_confidence,scanner_min_data_confidence,scanner_min_risk_reward,scanner_max_candidate_age_minutes")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

    if (evidenceError || !evidence)
      throw new Error("Selected Cossa evidence was not found for this instrument");
    if (controls.error || !controls.data)
      throw new Error("Scanner qualification controls are unavailable; execution fails closed");

    const direction = String(evidence.direction);
    if (direction !== "buy" && direction !== "sell")
      throw new Error("Selected Cossa evidence is not an executable BUY/SELL decision");
    if (direction !== input.side)
      throw new Error(`Order side must match current Cossa evidence (${direction.toUpperCase()})`);

    const confidence = Number(evidence.confidence_score ?? 0);
    const dataConfidence = Number(evidence.data_confidence_score ?? 0);
    const riskReward = evidence.risk_reward_ratio == null ? null : Number(evidence.risk_reward_ratio);
    const minConfidence = Number(controls.data.scanner_min_signal_confidence);
    const minDataConfidence = Number(controls.data.scanner_min_data_confidence);
    const minRiskReward = Number(controls.data.scanner_min_risk_reward);
    const maxAgeMinutes = Number(controls.data.scanner_max_candidate_age_minutes);
    const evidenceAt = evidence.data_to ?? evidence.generated_at;
    const evidenceAgeMs = Date.now() - new Date(evidenceAt).getTime();
    const noTradeReasons = Array.isArray(evidence.no_trade_reasons) ? evidence.no_trade_reasons : [];

    if (!Number.isFinite(evidenceAgeMs) || evidenceAgeMs < 0 || evidenceAgeMs > maxAgeMinutes * 60_000)
      throw new Error("Selected Cossa evidence is outside the configured scanner freshness window");
    if (confidence < minConfidence)
      throw new Error("Selected Cossa evidence is below the configured signal-confidence gate");
    if (dataConfidence < minDataConfidence)
      throw new Error("Selected Cossa evidence is below the configured data-confidence gate");
    if (riskReward == null || !Number.isFinite(riskReward) || riskReward < minRiskReward)
      throw new Error("Selected Cossa evidence is below the configured risk/reward gate");
    if (noTradeReasons.length > 0)
      throw new Error(`Selected Cossa evidence contains an engine rejection: ${String(noTradeReasons[0])}`);

    signalEvidence = {
      confidence,
      dataConfidence,
      generatedAt: evidence.generated_at,
      dataTo: evidence.data_to ?? null,
      direction,
      timeframe: String(evidence.timeframe),
      riskReward,
    };
  } else if (input.signalId) {
    const { data: signal, error: signalError } = await supabaseAdmin
      .from("signals")
      .select("id,instrument_id,direction,timeframe,confidence_score,data_timestamp,calculated_at,created_at")
      .eq("id", input.signalId)
      .eq("instrument_id", input.instrumentId)
      .single();
    if (signalError || !signal) throw new Error("Selected signal was not found for this instrument");

    const latestEngineRun = await supabaseAdmin
      .from("signal_engine_runs")
      .select("diagnostics,finished_at")
      .eq("instrument_id", input.instrumentId)
      .eq("timeframe", signal.timeframe)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestEngineRun.error) {
      throw new Error(`Unable to verify signal data confidence: ${latestEngineRun.error.message}`);
    }

    const confidence = Number(signal.confidence_score ?? 0);
    const dataConfidence = dataConfidenceFromDiagnostics(latestEngineRun.data?.diagnostics);
    const generatedAt =
      latestEngineRun.data?.finished_at ??
      signal.data_timestamp ??
      signal.calculated_at ??
      signal.created_at;
    signalEvidence = {
      confidence,
      dataConfidence,
      generatedAt,
      dataTo: signal.data_timestamp ?? null,
      direction: String(signal.direction),
      timeframe: String(signal.timeframe),
      riskReward: null,
    };
  }

  const isDemo = account.account_environment === "demo";
  if (isDemo && !signalEvidence) {
    throw new Error(
      "Demo auto execution requires current Cossa evidence so risk checks can verify confidence, data quality and freshness",
    );
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
      signal_id: input.signalEvidenceId ? null : input.signalId ?? null,
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
        signal_evidence_id: input.signalEvidenceId ?? null,
        confidence: signalEvidence?.confidence ?? null,
        data_confidence: signalEvidence?.dataConfidence ?? null,
        generated_at: signalEvidence?.generatedAt ?? null,
        evidence_data_to: signalEvidence?.dataTo ?? null,
        signal_direction: signalEvidence?.direction ?? null,
        timeframe: signalEvidence?.timeframe ?? null,
        risk_reward_ratio: signalEvidence?.riskReward ?? null,
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
      signal_evidence_id: input.signalEvidenceId ?? null,
      signal_confidence: signalEvidence?.confidence ?? null,
      data_confidence: signalEvidence?.dataConfidence ?? null,
      signal_generated_at: signalEvidence?.generatedAt ?? null,
      evidence_data_to: signalEvidence?.dataTo ?? null,
    },
  });
  if (eventError) throw new Error(`Unable to persist execution event: ${eventError.message}`);

  return order;
}
