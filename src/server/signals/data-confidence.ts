export type DataConfidenceInput = {
  candles: Array<{
    openTime: Date;
    closeTime: Date;
  }>;
  expectedIntervalMs: number;
  minimumCandles: number;
  now: Date;
  maximumAgeMs: number;
};

export type DataConfidenceResult = {
  score: number;
  version: "data-confidence-v1";
  components: {
    coverage: number;
    freshness: number;
    continuity: number;
  };
  diagnostics: {
    candleCount: number;
    minimumCandles: number;
    latestAgeMs: number;
    maximumAgeMs: number;
    expectedIntervals: number;
    missingIntervals: number;
  };
  reasons: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

export function evaluateDataConfidence(input: DataConfidenceInput): DataConfidenceResult {
  if (!Number.isFinite(input.expectedIntervalMs) || input.expectedIntervalMs <= 0) {
    throw new Error("expectedIntervalMs must be positive");
  }
  if (!Number.isFinite(input.minimumCandles) || input.minimumCandles < 1) {
    throw new Error("minimumCandles must be positive");
  }
  if (!Number.isFinite(input.maximumAgeMs) || input.maximumAgeMs <= 0) {
    throw new Error("maximumAgeMs must be positive");
  }
  if (input.candles.length === 0) throw new Error("At least one candle is required");

  const ordered = [...input.candles].sort(
    (a, b) => a.openTime.getTime() - b.openTime.getTime(),
  );
  const latest = ordered.at(-1)!;
  const latestAgeMs = input.now.getTime() - latest.closeTime.getTime();
  if (latestAgeMs < 0) throw new Error("Latest candle close time is in the future");

  const coverage = clamp((ordered.length / input.minimumCandles) * 100);

  // Freshness is an operational feed-quality measure, not a win probability.
  // Full credit is given through one expected interval. It then decays linearly
  // to zero at the configured maximum age.
  let freshness = 100;
  if (latestAgeMs > input.expectedIntervalMs) {
    const decayWindow = Math.max(1, input.maximumAgeMs - input.expectedIntervalMs);
    freshness = clamp(
      100 - ((latestAgeMs - input.expectedIntervalMs) / decayWindow) * 100,
    );
  }
  if (latestAgeMs > input.maximumAgeMs) freshness = 0;

  let expectedIntervals = 0;
  let missingIntervals = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const delta = current.openTime.getTime() - previous.openTime.getTime();
    const intervals = Math.max(1, Math.round(delta / input.expectedIntervalMs));
    expectedIntervals += intervals;
    missingIntervals += Math.max(0, intervals - 1);
  }
  const continuity = expectedIntervals === 0
    ? 100
    : clamp(((expectedIntervals - missingIntervals) / expectedIntervals) * 100);

  // Versioned transparent weights. These are data-quality weights, not trading
  // success probabilities. Any future weight change must increment the version.
  const score = clamp(coverage * 0.35 + freshness * 0.4 + continuity * 0.25);
  const reasons: string[] = [];
  if (coverage < 100) reasons.push("Candle sample is below the configured minimum");
  if (freshness < 100) reasons.push("Latest closed candle is aging beyond one expected interval");
  if (continuity < 100) reasons.push("One or more expected candle intervals are missing");
  if (reasons.length === 0) reasons.push("Coverage, freshness and continuity checks are healthy");

  return {
    score: rounded(score),
    version: "data-confidence-v1",
    components: {
      coverage: rounded(coverage),
      freshness: rounded(freshness),
      continuity: rounded(continuity),
    },
    diagnostics: {
      candleCount: ordered.length,
      minimumCandles: input.minimumCandles,
      latestAgeMs,
      maximumAgeMs: input.maximumAgeMs,
      expectedIntervals,
      missingIntervals,
    },
    reasons,
  };
}
