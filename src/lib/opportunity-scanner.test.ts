import { describe, expect, it } from "bun:test";

import {
  rankOpportunity,
  rankOpportunities,
  type ScannerEvidence,
  type ScannerSettings,
} from "./opportunity-scanner";

const settings: ScannerSettings = {
  minSignalConfidence: 65,
  minDataConfidence: 80,
  minRiskReward: 1.5,
  maxCandidateAgeMinutes: 240,
  weights: {
    signal: 0.35,
    data: 0.3,
    riskReward: 0.15,
    structure: 0.1,
    regime: 0.1,
  },
};

const now = new Date("2026-09-19T13:30:00.000Z");

function evidence(patch: Partial<ScannerEvidence> = {}): ScannerEvidence {
  return {
    id: "evidence-1",
    instrumentId: "instrument-1",
    symbol: "R_100",
    displayName: "Volatility 100 Index",
    assetClass: "synthetic_index",
    category: "volatility",
    timeframe: "5m",
    direction: "buy",
    regime: "trending_up",
    confidenceScore: 82,
    dataConfidenceScore: 94,
    riskRewardRatio: 2.2,
    entry: 100,
    stopLoss: 98,
    takeProfit1: 104.4,
    generatedAt: "2026-09-19T13:25:00.000Z",
    dataTo: "2026-09-19T13:25:00.000Z",
    noTradeReasons: [],
    reasons: ["Trend and momentum aligned"],
    structure: {
      trend: "bullish",
      breakout: "bullish",
      nearestSupport: 99,
      nearestResistance: 105,
    },
    ...patch,
  };
}

describe("rankOpportunity", () => {
  it("qualifies a fresh executable setup that clears all configured gates", () => {
    const result = rankOpportunity(evidence(), settings, now);
    expect(result.qualified).toBe(true);
    expect(result.riskSuitable).toBe(true);
    expect(result.qualificationReasons).toEqual([]);
    expect(result.opportunityScore).toBeGreaterThan(80);
  });

  it("rejects low Data Confidence even when Signal Confidence is very high", () => {
    const result = rankOpportunity(
      evidence({ confidenceScore: 99, dataConfidenceScore: 40 }),
      settings,
      now,
    );
    expect(result.qualified).toBe(false);
    expect(result.qualificationReasons.some((reason) => reason.includes("Data Confidence"))).toBe(true);
  });

  it("keeps NO-TRADE evidence visible but never qualifies it", () => {
    const result = rankOpportunity(
      evidence({
        direction: "no_trade",
        confidenceScore: 90,
        noTradeReasons: ["Regime instability"],
      }),
      settings,
      now,
    );
    expect(result.qualified).toBe(false);
    expect(result.qualificationReasons).toContain("No executable BUY/SELL decision");
    expect(result.qualificationReasons).toContain("Engine rejection: Regime instability");
  });

  it("rejects stale evidence independently of its component scores", () => {
    const result = rankOpportunity(
      evidence({ dataTo: "2026-09-19T06:00:00.000Z" }),
      settings,
      now,
    );
    expect(result.stale).toBe(true);
    expect(result.qualified).toBe(false);
  });

  it("rejects risk/reward below the configured minimum", () => {
    const result = rankOpportunity(evidence({ riskRewardRatio: 1.1 }), settings, now);
    expect(result.qualified).toBe(false);
    expect(result.riskSuitable).toBe(false);
  });

  it("sorts qualified opportunities before rejected evidence", () => {
    const ranked = rankOpportunities(
      [
        evidence({ id: "rejected", dataConfidenceScore: 20 }),
        evidence({ id: "qualified", confidenceScore: 70 }),
      ],
      settings,
      now,
    );
    expect(ranked[0].id).toBe("qualified");
    expect(ranked[1].id).toBe("rejected");
  });
});
