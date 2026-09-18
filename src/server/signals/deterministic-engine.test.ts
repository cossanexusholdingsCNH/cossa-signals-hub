import { describe, expect, it } from "bun:test";
import { buildTradePlan, type Candle } from "./deterministic-engine";

function candlesFromCloses(closes: number[]): Candle[] {
  return closes.map((close, index) => {
    const open = index === 0 ? close : closes[index - 1];
    const high = Math.max(open, close) + 0.25;
    const low = Math.min(open, close) - 0.25;
    return { open, high, low, close };
  });
}

describe("buildTradePlan", () => {
  it("rejects insufficient evidence", () => {
    expect(() =>
      buildTradePlan(candlesFromCloses(Array.from({ length: 59 }, (_, i) => 100 + i * 0.1))),
    ).toThrow("At least 60 closed candles are required");
  });

  it("creates a complete bullish plan with a database-compatible regime", () => {
    const closes = Array.from({ length: 100 }, (_, i) => 100 + i * 0.35);
    const plan = buildTradePlan(candlesFromCloses(closes));
    expect(plan.direction).toBe("buy");
    expect(plan.regime).toBe("trending_up");
    expect(plan.entry).not.toBeNull();
    expect(plan.stopLoss).toBeLessThan(plan.entry!);
    expect(plan.takeProfit1).toBeGreaterThan(plan.entry!);
    expect(plan.takeProfit2).toBeGreaterThan(plan.takeProfit1!);
    expect(plan.takeProfit3).toBeGreaterThan(plan.takeProfit2!);
    expect(plan.riskRewardRatio).toBe(3);
  });

  it("creates a complete bearish plan with a database-compatible regime", () => {
    const closes = Array.from({ length: 100 }, (_, i) => 150 - i * 0.3);
    const plan = buildTradePlan(candlesFromCloses(closes));
    expect(plan.direction).toBe("sell");
    expect(plan.regime).toBe("trending_down");
    expect(plan.entry).not.toBeNull();
    expect(plan.stopLoss).toBeGreaterThan(plan.entry!);
    expect(plan.takeProfit1).toBeLessThan(plan.entry!);
    expect(plan.takeProfit2).toBeLessThan(plan.takeProfit1!);
    expect(plan.takeProfit3).toBeLessThan(plan.takeProfit2!);
  });

  it("does not manufacture a trade from flat/no-edge candles", () => {
    const closes = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i / 3) * 0.05);
    const plan = buildTradePlan(candlesFromCloses(closes));
    expect(plan.direction).toBe("wait");
    expect(plan.regime).toBe("ranging");
    expect(plan.entry).toBeNull();
    expect(plan.stopLoss).toBeNull();
  });
});
