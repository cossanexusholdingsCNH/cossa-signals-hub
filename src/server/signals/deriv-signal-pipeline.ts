import { createHash } from "node:crypto";
import { analyzeMarketStructure, type MarketStructureAnalysis } from "../../lib/market-structure";
import { fetchDerivCandles, type DerivCandle } from "../market-data/deriv";
import { evaluateDataConfidence, type DataConfidenceResult } from "./data-confidence";
import { buildTradePlan, type Candle, type TradePlan } from "./deterministic-engine";

export type SupportedTimeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export type SignalPipelineInput = {
  instrumentId: string;
  providerId: string;
  providerSymbol: string;
  timeframe: SupportedTimeframe;
  now?: Date;
  minimumCandles?: number;
  maximumCandleAgeMs?: number;
};

export type NormalizedMarketCandle = Candle & {
  instrumentId: string;
  providerId: string;
  providerSymbol: string;
  timeframe: SupportedTimeframe;
  openTime: Date;
  closeTime: Date;
  isClosed: true;
  sourceEpoch: number;
};

export type SignalEvidence = {
  fingerprint: string;
  engineVersion: "deterministic-v1";
  generatedAt: string;
  instrumentId: string;
  providerId: string;
  providerSymbol: string;
  timeframe: SupportedTimeframe;
  dataFrom: string;
  dataTo: string;
  candleCount: number;
  dataConfidence: DataConfidenceResult;
  marketStructure: MarketStructureAnalysis;
  plan: TradePlan;
};

export type PaperExecutionCandidate = {
  fingerprint: string;
  mode: "paper";
  providerSymbol: string;
  timeframe: SupportedTimeframe;
  direction: "buy" | "sell";
  confidence: number;
  dataConfidence: number;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  createdAt: string;
};

const TIMEFRAME_SECONDS: Record<SupportedTimeframe, 60 | 300 | 900 | 1800 | 3600 | 14400 | 86400> =
  {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
  };

function assertIdentifier(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function normalizeClosedCandles(
  raw: DerivCandle[],
  input: SignalPipelineInput,
  now: Date,
): NormalizedMarketCandle[] {
  const seconds = TIMEFRAME_SECONDS[input.timeframe];
  const nowMs = now.getTime();
  const byEpoch = new Map<number, DerivCandle>();

  for (const candle of raw) {
    if (![candle.epoch, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
      continue;
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) continue;
    if (candle.high < Math.max(candle.open, candle.close, candle.low)) continue;
    if (candle.low > Math.min(candle.open, candle.close, candle.high)) continue;
    byEpoch.set(candle.epoch, candle);
  }

  return [...byEpoch.values()]
    .sort((a, b) => a.epoch - b.epoch)
    .filter((candle) => (candle.epoch + seconds) * 1000 <= nowMs)
    .map((candle) => ({
      instrumentId: input.instrumentId,
      providerId: input.providerId,
      providerSymbol: input.providerSymbol.trim(),
      timeframe: input.timeframe,
      openTime: new Date(candle.epoch * 1000),
      closeTime: new Date((candle.epoch + seconds) * 1000),
      sourceEpoch: candle.epoch,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      isClosed: true as const,
    }));
}

function fingerprint(input: SignalPipelineInput, candles: NormalizedMarketCandle[]) {
  const latest = candles.at(-1)!;
  return createHash("sha256")
    .update(
      [
        "deterministic-v1",
        input.instrumentId,
        input.providerId,
        input.providerSymbol.trim(),
        input.timeframe,
        latest.sourceEpoch,
        latest.close,
      ].join("|"),
    )
    .digest("hex");
}

export async function runDerivSignalPipeline(input: SignalPipelineInput): Promise<{
  candles: NormalizedMarketCandle[];
  evidence: SignalEvidence;
  paperCandidate: PaperExecutionCandidate | null;
}> {
  assertIdentifier(input.instrumentId, "instrumentId");
  assertIdentifier(input.providerId, "providerId");
  assertIdentifier(input.providerSymbol, "providerSymbol");

  const now = input.now ?? new Date();
  const minimumCandles = Math.max(60, input.minimumCandles ?? 100);
  const granularitySeconds = TIMEFRAME_SECONDS[input.timeframe];
  const expectedIntervalMs = granularitySeconds * 1000;
  const maximumCandleAgeMs = input.maximumCandleAgeMs ?? granularitySeconds * 2 * 1000;

  const raw = await fetchDerivCandles(
    input.providerSymbol,
    granularitySeconds,
    Math.max(minimumCandles + 10, 120),
  );
  const candles = normalizeClosedCandles(raw, input, now);

  if (candles.length < minimumCandles) {
    throw new Error(
      `Insufficient closed candles: required ${minimumCandles}, received ${candles.length}`,
    );
  }

  const latest = candles.at(-1)!;
  const ageMs = now.getTime() - latest.closeTime.getTime();
  if (ageMs < 0) throw new Error("Latest candle close time is in the future");
  if (ageMs > maximumCandleAgeMs) {
    throw new Error(`Stale market data: latest closed candle is ${ageMs}ms old`);
  }

  const analysisWindow = candles.slice(-minimumCandles);
  const dataConfidence = evaluateDataConfidence({
    candles: analysisWindow,
    expectedIntervalMs,
    minimumCandles,
    now,
    maximumAgeMs: maximumCandleAgeMs,
  });
  const marketStructure = analyzeMarketStructure(analysisWindow);
  const plan = buildTradePlan(analysisWindow);
  const fp = fingerprint(input, analysisWindow);
  const evidence: SignalEvidence = {
    fingerprint: fp,
    engineVersion: "deterministic-v1",
    generatedAt: now.toISOString(),
    instrumentId: input.instrumentId,
    providerId: input.providerId,
    providerSymbol: input.providerSymbol.trim(),
    timeframe: input.timeframe,
    dataFrom: analysisWindow[0].openTime.toISOString(),
    dataTo: analysisWindow.at(-1)!.closeTime.toISOString(),
    candleCount: analysisWindow.length,
    dataConfidence,
    marketStructure,
    plan,
  };

  const executable =
    (plan.direction === "buy" || plan.direction === "sell") &&
    plan.entry !== null &&
    plan.stopLoss !== null &&
    plan.takeProfit1 !== null &&
    plan.takeProfit2 !== null &&
    plan.takeProfit3 !== null &&
    plan.riskRewardRatio !== null;

  const paperCandidate: PaperExecutionCandidate | null = executable
    ? {
        fingerprint: fp,
        mode: "paper",
        providerSymbol: input.providerSymbol.trim(),
        timeframe: input.timeframe,
        direction: plan.direction as "buy" | "sell",
        confidence: plan.confidence,
        dataConfidence: dataConfidence.score,
        entry: plan.entry!,
        stopLoss: plan.stopLoss!,
        takeProfit1: plan.takeProfit1!,
        takeProfit2: plan.takeProfit2!,
        takeProfit3: plan.takeProfit3!,
        riskRewardRatio: plan.riskRewardRatio!,
        createdAt: now.toISOString(),
      }
    : null;

  return { candles: analysisWindow, evidence, paperCandidate };
}
