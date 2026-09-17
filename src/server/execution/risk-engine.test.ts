import { describe, expect, it } from 'bun:test';
import { evaluateExecutionRisk, type ExecutionRiskInput } from './risk-engine';

const base: ExecutionRiskInput = {
  equity: 10_000,
  balance: 10_000,
  startOfDayEquity: 10_000,
  riskPct: 1,
  maxRiskPerTradePct: 1,
  maxDailyLossPct: 3,
  maxOpenPositions: 3,
  openPositions: 0,
  entry: 100,
  stopLoss: 98,
  confidence: 80,
  minimumConfidence: 70,
  marketDataAgeMs: 30_000,
  maximumMarketDataAgeMs: 120_000,
  accountEnabled: true,
  emergencyStop: false,
  duplicateOrder: false,
  valuePerPriceUnit: 1,
  minimumPositionSize: 0.01,
  positionStep: 0.01,
};

describe('evaluateExecutionRisk', () => {
  it('approves a valid paper risk decision and sizes from equity and stop distance', () => {
    const result = evaluateExecutionRisk(base);
    expect(result.approved).toBe(true);
    expect(result.riskAmount).toBe(100);
    expect(result.stopDistance).toBe(2);
    expect(result.positionSize).toBe(50);
    expect(result.rejectionReasons).toEqual([]);
  });

  it('fails closed when emergency stop is active', () => {
    const result = evaluateExecutionRisk({ ...base, emergencyStop: true });
    expect(result.approved).toBe(false);
    expect(result.rejectionReasons).toContain('Emergency stop is active');
  });

  it('rejects when the daily loss threshold has been reached', () => {
    const result = evaluateExecutionRisk({ ...base, equity: 9_700 });
    expect(result.dailyLossPct).toBe(3);
    expect(result.approved).toBe(false);
    expect(result.rejectionReasons).toContain('Maximum daily loss threshold reached');
  });

  it('rejects stale market data', () => {
    const result = evaluateExecutionRisk({ ...base, marketDataAgeMs: 120_001 });
    expect(result.approved).toBe(false);
    expect(result.rejectionReasons).toContain('Market data is stale');
  });

  it('rejects duplicate execution intents', () => {
    const result = evaluateExecutionRisk({ ...base, duplicateOrder: true });
    expect(result.approved).toBe(false);
    expect(result.rejectionReasons).toContain('Duplicate execution intent detected');
  });

  it('rejects requested risk above the configured account limit rather than silently approving the capped value', () => {
    const result = evaluateExecutionRisk({ ...base, riskPct: 2 });
    expect(result.riskPct).toBe(1);
    expect(result.approved).toBe(false);
    expect(result.rejectionReasons).toContain('Requested risk exceeds account per-trade limit');
  });
});
