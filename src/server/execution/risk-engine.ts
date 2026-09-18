export type ExecutionRiskInput = {
  equity: number;
  balance: number;
  startOfDayEquity: number;
  riskPct: number;
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  openPositions: number;
  entry: number;
  stopLoss: number;
  confidence: number;
  minimumConfidence: number;
  marketDataAgeMs: number;
  maximumMarketDataAgeMs: number;
  accountEnabled: boolean;
  emergencyStop: boolean;
  duplicateOrder: boolean;
  valuePerPriceUnit?: number;
  minimumPositionSize?: number;
  maximumPositionSize?: number;
  positionStep?: number;
};

export type ExecutionRiskDecision = {
  approved: boolean;
  riskAmount: number;
  riskPct: number;
  stopDistance: number;
  rawPositionSize: number;
  positionSize: number;
  dailyLossAmount: number;
  dailyLossPct: number;
  gates: {
    accountEnabled: boolean;
    emergencyStopClear: boolean;
    dailyLossGateClear: boolean;
    openPositionGateClear: boolean;
    perTradeRiskGateClear: boolean;
    signalQualityGateClear: boolean;
    staleDataGateClear: boolean;
    duplicateOrderGateClear: boolean;
    positionSizeGateClear: boolean;
  };
  rejectionReasons: string[];
};

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

function floorToStep(value: number, step: number) {
  const precision = Math.max(0, (String(step).split(".")[1] ?? "").length);
  const floored = Math.floor((value + Number.EPSILON) / step) * step;
  return Number(floored.toFixed(precision));
}

export function evaluateExecutionRisk(input: ExecutionRiskInput): ExecutionRiskDecision {
  if (!finitePositive(input.equity)) throw new Error("Account equity must be positive");
  if (!finitePositive(input.balance)) throw new Error("Account balance must be positive");
  if (!finitePositive(input.startOfDayEquity))
    throw new Error("Start-of-day equity must be positive");
  if (!finitePositive(input.entry) || !finitePositive(input.stopLoss))
    throw new Error("Entry and stop loss must be positive");

  const stopDistance = Math.abs(input.entry - input.stopLoss);
  if (!finitePositive(stopDistance)) throw new Error("Stop distance must be positive");

  const requestedRiskPct = Math.max(0, input.riskPct);
  const riskPct = Math.min(requestedRiskPct, input.maxRiskPerTradePct);
  const riskAmount = input.equity * (riskPct / 100);
  const dailyLossAmount = Math.max(0, input.startOfDayEquity - input.equity);
  const dailyLossPct = (dailyLossAmount / input.startOfDayEquity) * 100;
  const valuePerPriceUnit = input.valuePerPriceUnit ?? 1;
  const step = input.positionStep ?? 0.01;

  if (!finitePositive(valuePerPriceUnit)) throw new Error("valuePerPriceUnit must be positive");
  if (!finitePositive(step)) throw new Error("positionStep must be positive");

  const rawPositionSize = riskAmount / (stopDistance * valuePerPriceUnit);
  let positionSize = floorToStep(rawPositionSize, step);
  if (input.maximumPositionSize && finitePositive(input.maximumPositionSize)) {
    positionSize = Math.min(positionSize, floorToStep(input.maximumPositionSize, step));
  }

  const gates = {
    accountEnabled: input.accountEnabled,
    emergencyStopClear: !input.emergencyStop,
    dailyLossGateClear: dailyLossPct < input.maxDailyLossPct,
    openPositionGateClear: input.openPositions < input.maxOpenPositions,
    perTradeRiskGateClear: requestedRiskPct > 0 && requestedRiskPct <= input.maxRiskPerTradePct,
    signalQualityGateClear: input.confidence >= input.minimumConfidence,
    staleDataGateClear:
      input.marketDataAgeMs >= 0 && input.marketDataAgeMs <= input.maximumMarketDataAgeMs,
    duplicateOrderGateClear: !input.duplicateOrder,
    positionSizeGateClear:
      finitePositive(positionSize) &&
      (!input.minimumPositionSize || positionSize >= input.minimumPositionSize),
  };

  const rejectionReasons: string[] = [];
  if (!gates.accountEnabled) rejectionReasons.push("Trading account is disabled");
  if (!gates.emergencyStopClear) rejectionReasons.push("Emergency stop is active");
  if (!gates.dailyLossGateClear) rejectionReasons.push("Maximum daily loss threshold reached");
  if (!gates.openPositionGateClear) rejectionReasons.push("Maximum open positions reached");
  if (!gates.perTradeRiskGateClear)
    rejectionReasons.push("Requested risk exceeds account per-trade limit");
  if (!gates.signalQualityGateClear)
    rejectionReasons.push("Signal confidence is below execution threshold");
  if (!gates.staleDataGateClear) rejectionReasons.push("Market data is stale");
  if (!gates.duplicateOrderGateClear) rejectionReasons.push("Duplicate execution intent detected");
  if (!gates.positionSizeGateClear)
    rejectionReasons.push("Calculated position size is not executable");

  return {
    approved: Object.values(gates).every(Boolean),
    riskAmount,
    riskPct,
    stopDistance,
    rawPositionSize,
    positionSize,
    dailyLossAmount,
    dailyLossPct,
    gates,
    rejectionReasons,
  };
}
