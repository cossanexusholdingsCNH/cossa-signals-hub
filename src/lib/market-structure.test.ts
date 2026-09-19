import { describe, expect, it } from "bun:test";

import { analyzeMarketStructure, type StructureCandle } from "./market-structure";

function waveCandles(count: number, slope: number): StructureCandle[] {
  return Array.from({ length: count }, (_, index) => {
    const centre = 100 + index * slope + Math.sin((index * Math.PI) / 3) * 2.5;
    const open = centre - 0.25;
    const close = centre + 0.25;
    return {
      open,
      high: Math.max(open, close) + 0.8,
      low: Math.min(open, close) - 0.8,
      close,
      openTime: new Date(Date.UTC(2026, 8, 19, 0, index * 5)).toISOString(),
    };
  });
}

describe("analyzeMarketStructure", () => {
  it("classifies rising swing highs and lows as bullish structure", () => {
    const result = analyzeMarketStructure(waveCandles(48, 0.35));
    expect(result.version).toBe("structure-v1");
    expect(result.trend).toBe("bullish");
    expect(result.structureLabel).toBe("HH_HL");
    expect(result.swingHighs.length).toBeGreaterThanOrEqual(2);
    expect(result.swingLows.length).toBeGreaterThanOrEqual(2);
  });

  it("classifies falling swing highs and lows as bearish structure", () => {
    const result = analyzeMarketStructure(waveCandles(48, -0.35));
    expect(result.trend).toBe("bearish");
    expect(result.structureLabel).toBe("LH_LL");
  });

  it("detects a close above the last confirmed swing high as a bullish breakout", () => {
    const candles = waveCandles(42, 0.05);
    const baseline = analyzeMarketStructure(candles);
    const lastSwingHigh = baseline.swingHighs.at(-1);
    expect(lastSwingHigh).toBeDefined();
    const prior = candles.at(-1)!;
    const breakoutClose = lastSwingHigh!.price + Math.max(baseline.atr, 1) * 0.5;
    candles.push({
      open: prior.close,
      high: breakoutClose + 0.5,
      low: Math.min(prior.close, breakoutClose) - 0.5,
      close: breakoutClose,
      openTime: new Date(Date.UTC(2026, 8, 19, 4, 0)).toISOString(),
    });
    const result = analyzeMarketStructure(candles);
    expect(result.breakout).toBe("bullish");
  });

  it("fails closed on insufficient evidence", () => {
    expect(() => analyzeMarketStructure(waveCandles(10, 0.1))).toThrow(
      "At least 20 closed candles are required for structure analysis",
    );
  });
});
