export type ScannerDirection = "buy" | "sell" | "neutral" | "wait" | "no_trade";

export type ScannerStructure = {
  trend: "bullish" | "bearish" | "range" | "transition";
  breakout: "bullish" | "bearish" | "none";
  nearestSupport?: number | null;
  nearestResistance?: number | null;
};

export type ScannerSettings = {
  minSignalConfidence: number;
  minDataConfidence: number;
  minRiskReward: number;
  maxCandidateAgeMinutes: number;
  weights: {
    signal: number;
    data: number;
    riskReward: number;
    structure: number;
    regime: number;
  };
};

export type ScannerEvidence = {
  id: string;
  instrumentId: string;
  symbol: string;
  displayName: string;
  assetClass: string;
  category: string;
  timeframe: string;
  direction: ScannerDirection;
  regime: string;
  confidenceScore: number;
  dataConfidenceScore: number | null;
  riskRewardRatio: number | null;
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  generatedAt: string;
  dataTo: string;
  noTradeReasons: string[];
  reasons: string[];
  structure: ScannerStructure | null;
};

export type RankedOpportunity = ScannerEvidence & {
  opportunityScore: number;
  qualified: boolean;
  riskSuitable: boolean;
  stale: boolean;
  qualificationReasons: string[];
  components: {
    signal: number;
    data: number;
    riskReward: number;
    structure: number;
    regime: number;
  };
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function structureAlignment(direction: ScannerDirection, structure: ScannerStructure | null) {
  if (!structure) return 40;
  if (direction !== "buy" && direction !== "sell") return 20;

  const alignedTrend =
    (direction === "buy" && structure.trend === "bullish") ||
    (direction === "sell" && structure.trend === "bearish");
  const opposedTrend =
    (direction === "buy" && structure.trend === "bearish") ||
    (direction === "sell" && structure.trend === "bullish");
  const alignedBreakout =
    (direction === "buy" && structure.breakout === "bullish") ||
    (direction === "sell" && structure.breakout === "bearish");
  const opposedBreakout =
    (direction === "buy" && structure.breakout === "bearish") ||
    (direction === "sell" && structure.breakout === "bullish");

  if (alignedTrend && alignedBreakout) return 100;
  if (alignedTrend) return 85;
  if (alignedBreakout) return 75;
  if (opposedTrend && opposedBreakout) return 10;
  if (opposedTrend || opposedBreakout) return 25;
  if (structure.trend === "transition") return 50;
  return 60;
}

function regimeAlignment(direction: ScannerDirection, regime: string) {
  if (direction !== "buy" && direction !== "sell") return 20;
  if (regime === "breakout") return 90;
  if (direction === "buy" && regime === "trending_up") return 100;
  if (direction === "sell" && regime === "trending_down") return 100;
  if (direction === "buy" && regime === "trending_down") return 15;
  if (direction === "sell" && regime === "trending_up") return 15;
  if (regime === "ranging") return 60;
  if (regime === "low_volatility") return 55;
  if (regime === "high_volatility") return 45;
  if (regime === "spike_risk" || regime === "unstable" || regime === "reset_window") return 20;
  return 40;
}

export function validateScannerSettings(settings: ScannerSettings) {
  const values = [
    settings.minSignalConfidence,
    settings.minDataConfidence,
    settings.minRiskReward,
    settings.maxCandidateAgeMinutes,
    settings.weights.signal,
    settings.weights.data,
    settings.weights.riskReward,
    settings.weights.structure,
    settings.weights.regime,
  ];
  if (!values.every(Number.isFinite)) throw new Error("Scanner settings must be finite numbers");
  if (settings.minSignalConfidence < 0 || settings.minSignalConfidence > 100)
    throw new Error("minSignalConfidence must be between 0 and 100");
  if (settings.minDataConfidence < 0 || settings.minDataConfidence > 100)
    throw new Error("minDataConfidence must be between 0 and 100");
  if (settings.minRiskReward <= 0) throw new Error("minRiskReward must be greater than zero");
  if (settings.maxCandidateAgeMinutes < 1)
    throw new Error("maxCandidateAgeMinutes must be at least one minute");

  const weights = Object.values(settings.weights);
  if (weights.some((weight) => weight < 0 || weight > 1))
    throw new Error("Scanner weights must be between 0 and 1");
  const sum = weights.reduce((total, weight) => total + weight, 0);
  if (Math.abs(sum - 1) > 0.0001) throw new Error("Scanner weights must sum to 1");
}

export function rankOpportunity(
  evidence: ScannerEvidence,
  settings: ScannerSettings,
  now = new Date(),
): RankedOpportunity {
  validateScannerSettings(settings);

  const qualificationReasons: string[] = [];
  const executable = evidence.direction === "buy" || evidence.direction === "sell";
  if (!executable) qualificationReasons.push("No executable BUY/SELL decision");
  if (evidence.confidenceScore < settings.minSignalConfidence) {
    qualificationReasons.push(
      `Signal Confidence ${evidence.confidenceScore.toFixed(1)} is below ${settings.minSignalConfidence.toFixed(1)}`,
    );
  }
  if (evidence.dataConfidenceScore == null) {
    qualificationReasons.push("Data Confidence is unavailable");
  } else if (evidence.dataConfidenceScore < settings.minDataConfidence) {
    qualificationReasons.push(
      `Data Confidence ${evidence.dataConfidenceScore.toFixed(1)} is below ${settings.minDataConfidence.toFixed(1)}`,
    );
  }
  if (evidence.riskRewardRatio == null) {
    qualificationReasons.push("Risk/reward plan is unavailable");
  } else if (evidence.riskRewardRatio < settings.minRiskReward) {
    qualificationReasons.push(
      `R:R ${evidence.riskRewardRatio.toFixed(2)} is below ${settings.minRiskReward.toFixed(2)}`,
    );
  }
  for (const reason of evidence.noTradeReasons) {
    qualificationReasons.push(`Engine rejection: ${reason}`);
  }

  const dataToMs = new Date(evidence.dataTo).getTime();
  const ageMinutes = Number.isFinite(dataToMs) ? (now.getTime() - dataToMs) / 60_000 : Infinity;
  const stale = ageMinutes < 0 || ageMinutes > settings.maxCandidateAgeMinutes;
  if (stale) qualificationReasons.push("Evidence is outside the configured scanner freshness window");

  const signal = clamp(evidence.confidenceScore);
  const data = clamp(evidence.dataConfidenceScore ?? 0);
  const riskReward = clamp(
    evidence.riskRewardRatio == null
      ? 0
      : (evidence.riskRewardRatio / Math.max(settings.minRiskReward * 2, 0.01)) * 100,
  );
  const structure = structureAlignment(evidence.direction, evidence.structure);
  const regime = regimeAlignment(evidence.direction, evidence.regime);

  const opportunityScore = clamp(
    signal * settings.weights.signal +
      data * settings.weights.data +
      riskReward * settings.weights.riskReward +
      structure * settings.weights.structure +
      regime * settings.weights.regime,
  );

  const riskSuitable =
    executable &&
    evidence.noTradeReasons.length === 0 &&
    evidence.riskRewardRatio != null &&
    evidence.riskRewardRatio >= settings.minRiskReward;

  return {
    ...evidence,
    opportunityScore: Math.round(opportunityScore * 10) / 10,
    qualified: qualificationReasons.length === 0,
    riskSuitable,
    stale,
    qualificationReasons,
    components: {
      signal: Math.round(signal * 10) / 10,
      data: Math.round(data * 10) / 10,
      riskReward: Math.round(riskReward * 10) / 10,
      structure,
      regime,
    },
  };
}

export function rankOpportunities(
  evidence: ScannerEvidence[],
  settings: ScannerSettings,
  now = new Date(),
) {
  return evidence
    .map((item) => rankOpportunity(item, settings, now))
    .sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      if (a.opportunityScore !== b.opportunityScore) return b.opportunityScore - a.opportunityScore;
      return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
    });
}
