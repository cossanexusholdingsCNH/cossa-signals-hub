import { supabaseAdmin } from "../../integrations/supabase/client.server";
import {
  runDerivSignalPipeline,
  type PaperExecutionCandidate,
  type SignalEvidence,
  type SignalPipelineInput,
} from "./deriv-signal-pipeline";

const ENGINE_VERSION = "deterministic-v1";

type PersistResult = {
  evidenceId: string;
  engineRunId: string;
  paperOrderId: string | null;
  duplicate: boolean;
  evidence: SignalEvidence;
};

function asIso(value: Date) {
  return value.toISOString();
}

function executionIdempotencyKey(evidence: SignalEvidence) {
  return `paper:${evidence.fingerprint}`;
}

async function persistCandles(
  candles: Awaited<ReturnType<typeof runDerivSignalPipeline>>["candles"],
) {
  const rows = candles.map((c) => ({
    instrument_id: c.instrumentId,
    provider_id: c.providerId,
    provider_symbol: c.providerSymbol,
    timeframe: c.timeframe,
    open_time: asIso(c.openTime),
    close_time: asIso(c.closeTime),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    is_closed: true,
    is_demo: false,
    metadata: { source_epoch: c.sourceEpoch },
  }));

  const { error } = await supabaseAdmin
    .from("market_candles")
    .upsert(rows, {
      onConflict: "instrument_id,provider_id,timeframe,open_time",
      ignoreDuplicates: true,
    });
  if (error) throw new Error(`Unable to persist market candles: ${error.message}`);
}

async function persistEvidence(
  evidence: SignalEvidence,
): Promise<{ id: string; duplicate: boolean }> {
  const row = {
    fingerprint: evidence.fingerprint,
    instrument_id: evidence.instrumentId,
    provider_id: evidence.providerId,
    provider_symbol: evidence.providerSymbol,
    timeframe: evidence.timeframe,
    engine_version: evidence.engineVersion,
    data_from: evidence.dataFrom,
    data_to: evidence.dataTo,
    candle_count: evidence.candleCount,
    direction: evidence.plan.direction,
    regime: evidence.plan.regime,
    confidence_score: evidence.plan.confidence,
    entry: evidence.plan.entry,
    entry_zone_low: evidence.plan.entryZoneLow,
    entry_zone_high: evidence.plan.entryZoneHigh,
    stop_loss: evidence.plan.stopLoss,
    take_profit_1: evidence.plan.takeProfit1,
    take_profit_2: evidence.plan.takeProfit2,
    take_profit_3: evidence.plan.takeProfit3,
    risk_reward_ratio: evidence.plan.riskRewardRatio,
    indicators: evidence.plan.indicators,
    reasons: evidence.plan.reasons,
    no_trade_reasons: evidence.plan.noTradeReasons,
    generated_at: evidence.generatedAt,
  };

  const { data, error } = await supabaseAdmin
    .from("signal_evidence")
    .upsert(row, { onConflict: "fingerprint", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Unable to persist signal evidence: ${error.message}`);
  if (data?.id) return { id: data.id, duplicate: false };

  const existing = await supabaseAdmin
    .from("signal_evidence")
    .select("id")
    .eq("fingerprint", evidence.fingerprint)
    .single();
  if (existing.error || !existing.data?.id) {
    throw new Error(`Evidence dedupe lookup failed: ${existing.error?.message ?? "missing row"}`);
  }
  return { id: existing.data.id, duplicate: true };
}

async function persistEngineRun(evidence: SignalEvidence, signalId: string | null = null) {
  const status = evidence.plan.direction === "wait" ? "no_trade" : "signal_created";
  const { data, error } = await supabaseAdmin
    .from("signal_engine_runs")
    .insert({
      instrument_id: evidence.instrumentId,
      timeframe: evidence.timeframe,
      engine_version: ENGINE_VERSION,
      status,
      data_from: evidence.dataFrom,
      data_to: evidence.dataTo,
      candle_count: evidence.candleCount,
      regime: evidence.plan.regime,
      direction: evidence.plan.direction,
      confidence_score: evidence.plan.confidence,
      signal_id: signalId,
      no_trade_reasons: evidence.plan.noTradeReasons,
      diagnostics: {
        fingerprint: evidence.fingerprint,
        provider_id: evidence.providerId,
        provider_symbol: evidence.providerSymbol,
        indicators: evidence.plan.indicators,
        reasons: evidence.plan.reasons,
      },
      finished_at: evidence.generatedAt,
    })
    .select("id")
    .single();
  if (error || !data?.id)
    throw new Error(`Unable to persist engine run: ${error?.message ?? "missing id"}`);
  return data.id;
}

async function createPaperOrder(
  candidate: PaperExecutionCandidate,
  evidence: SignalEvidence,
  tradingAccountId: string | null,
  userId: string | null,
): Promise<string | null> {
  if (!tradingAccountId || !userId) return null;

  const account = await supabaseAdmin
    .from("trading_accounts")
    .select("id,user_id,account_environment,execution_mode,enabled,emergency_stop,currency")
    .eq("id", tradingAccountId)
    .eq("user_id", userId)
    .single();
  if (account.error || !account.data) throw new Error("Paper trading account was not found");
  if (!account.data.enabled) return null;
  if (account.data.emergency_stop) return null;
  if (account.data.account_environment !== "demo" || account.data.execution_mode !== "paper_auto")
    return null;

  const idempotencyKey = executionIdempotencyKey(evidence);
  const existing = await supabaseAdmin
    .from("execution_orders")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;

  // requested_amount is a temporary paper placeholder only. The fail-closed
  // risk coordinator replaces it with the calculated position size before submission.
  const { data, error } = await supabaseAdmin
    .from("execution_orders")
    .insert({
      user_id: userId,
      trading_account_id: tradingAccountId,
      instrument_id: evidence.instrumentId,
      side: candidate.direction,
      execution_mode: "paper_auto",
      status: "approved",
      requested_entry: candidate.entry,
      stop_loss: candidate.stopLoss,
      take_profit_1: candidate.takeProfit1,
      take_profit_2: candidate.takeProfit2,
      take_profit_3: candidate.takeProfit3,
      requested_amount: 1,
      requested_currency: account.data.currency,
      risk_reward_ratio: candidate.riskRewardRatio,
      idempotency_key: idempotencyKey,
      confirmation_required: false,
      metadata: {
        signal_evidence_fingerprint: evidence.fingerprint,
        provider_id: evidence.providerId,
        provider_symbol: candidate.providerSymbol,
        timeframe: candidate.timeframe,
        confidence: candidate.confidence,
        signal_generated_at: evidence.generatedAt,
        market_data_from: evidence.dataFrom,
        market_data_to: evidence.dataTo,
        engine_version: evidence.engineVersion,
        paper_only: true,
      },
    })
    .select("id")
    .single();
  if (error || !data?.id)
    throw new Error(`Unable to create paper order: ${error?.message ?? "missing id"}`);
  return data.id;
}

export async function runAndPersistDerivSignal(
  input: SignalPipelineInput & { tradingAccountId?: string; userId?: string },
): Promise<PersistResult> {
  const result = await runDerivSignalPipeline(input);
  await persistCandles(result.candles);

  const storedEvidence = await persistEvidence(result.evidence);
  // A duplicate means this exact closed-candle decision was already processed.
  // Do not create a second engine run or paper order during scheduler retries.
  if (storedEvidence.duplicate) {
    return {
      evidenceId: storedEvidence.id,
      engineRunId: "",
      paperOrderId: null,
      duplicate: true,
      evidence: result.evidence,
    };
  }

  const engineRunId = await persistEngineRun(result.evidence);
  const paperOrderId = result.paperCandidate
    ? await createPaperOrder(
        result.paperCandidate,
        result.evidence,
        input.tradingAccountId ?? null,
        input.userId ?? null,
      )
    : null;

  return {
    evidenceId: storedEvidence.id,
    engineRunId,
    paperOrderId,
    duplicate: false,
    evidence: result.evidence,
  };
}
