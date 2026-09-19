import { describe, expect, test } from "bun:test";

import { evaluateDataConfidence } from "./data-confidence";

function candles(count: number, intervalMs: number, endMs: number) {
  const start = endMs - count * intervalMs;
  return Array.from({ length: count }, (_, index) => {
    const openMs = start + index * intervalMs;
    return {
      openTime: new Date(openMs),
      closeTime: new Date(openMs + intervalMs),
    };
  });
}

describe("evaluateDataConfidence", () => {
  test("returns full confidence for complete fresh continuous evidence", () => {
    const interval = 300_000;
    const now = new Date("2026-09-19T12:00:00.000Z");
    const result = evaluateDataConfidence({
      candles: candles(100, interval, now.getTime()),
      expectedIntervalMs: interval,
      minimumCandles: 100,
      now,
      maximumAgeMs: interval * 2,
    });

    expect(result.score).toBe(100);
    expect(result.components).toEqual({ coverage: 100, freshness: 100, continuity: 100 });
    expect(result.diagnostics.missingIntervals).toBe(0);
  });

  test("reduces score when candle continuity has gaps", () => {
    const interval = 300_000;
    const now = new Date("2026-09-19T12:00:00.000Z");
    const series = candles(100, interval, now.getTime());
    series.splice(40, 3);

    const result = evaluateDataConfidence({
      candles: series,
      expectedIntervalMs: interval,
      minimumCandles: 100,
      now,
      maximumAgeMs: interval * 2,
    });

    expect(result.score).toBeLessThan(100);
    expect(result.components.coverage).toBe(97);
    expect(result.components.continuity).toBeLessThan(100);
    expect(result.diagnostics.missingIntervals).toBe(3);
  });

  test("fails data freshness to zero after the configured maximum age", () => {
    const interval = 300_000;
    const evidenceEnd = new Date("2026-09-19T12:00:00.000Z");
    const now = new Date(evidenceEnd.getTime() + interval * 3);
    const result = evaluateDataConfidence({
      candles: candles(100, interval, evidenceEnd.getTime()),
      expectedIntervalMs: interval,
      minimumCandles: 100,
      now,
      maximumAgeMs: interval * 2,
    });

    expect(result.components.freshness).toBe(0);
    expect(result.score).toBeLessThan(100);
  });
});
