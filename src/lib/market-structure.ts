export type StructureCandle = {
  open: number;
  high: number;
  low: number;
  close: number;
  openTime?: string | Date;
};

export type StructurePoint = {
  index: number;
  price: number;
  time: string | null;
};

export type LiquidityReference = {
  kind: "equal_highs" | "equal_lows";
  price: number;
  touches: number;
};

export type MarketStructureAnalysis = {
  version: "structure-v1";
  trend: "bullish" | "bearish" | "range" | "transition";
  structureLabel: "HH_HL" | "LH_LL" | "MIXED" | "INSUFFICIENT_SWINGS";
  breakout: "bullish" | "bearish" | "none";
  currentPrice: number;
  atr: number;
  supportLevels: number[];
  resistanceLevels: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
  swingHighs: StructurePoint[];
  swingLows: StructurePoint[];
  liquidityReferences: LiquidityReference[];
  reasons: string[];
};

function finitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function toIso(value: string | Date | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageTrueRange(candles: StructureCandle[], period = 14) {
  const start = Math.max(1, candles.length - period);
  const ranges: number[] = [];
  for (let index = start; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousClose = candles[index - 1].close;
    ranges.push(
      Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previousClose),
        Math.abs(candle.low - previousClose),
      ),
    );
  }
  return ranges.length ? mean(ranges) : candles.at(-1)!.high - candles.at(-1)!.low;
}

function uniqueLevels(values: number[], tolerance: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const value of sorted) {
    const cluster = clusters.at(-1);
    if (!cluster || Math.abs(value - mean(cluster)) > tolerance) clusters.push([value]);
    else cluster.push(value);
  }
  return clusters.map((cluster) => mean(cluster));
}

function equalLevelReferences(
  points: StructurePoint[],
  tolerance: number,
  kind: LiquidityReference["kind"],
) {
  const clusters: StructurePoint[][] = [];
  for (const point of points) {
    const existing = clusters.find(
      (cluster) => Math.abs(point.price - mean(cluster.map((item) => item.price))) <= tolerance,
    );
    if (existing) existing.push(point);
    else clusters.push([point]);
  }
  return clusters
    .filter((cluster) => cluster.length >= 2)
    .map((cluster) => ({
      kind,
      price: mean(cluster.map((item) => item.price)),
      touches: cluster.length,
    }));
}

export function analyzeMarketStructure(
  candles: StructureCandle[],
  swingWindow = 2,
): MarketStructureAnalysis {
  if (candles.length < 20) throw new Error("At least 20 closed candles are required for structure analysis");
  if (!Number.isInteger(swingWindow) || swingWindow < 1 || swingWindow > 5)
    throw new Error("swingWindow must be an integer between 1 and 5");

  for (const candle of candles) {
    if (![candle.open, candle.high, candle.low, candle.close].every(finitePositive))
      throw new Error("Structure candle prices must be finite and positive");
    if (candle.high < Math.max(candle.open, candle.close, candle.low))
      throw new Error("Invalid structure candle high");
    if (candle.low > Math.min(candle.open, candle.close, candle.high))
      throw new Error("Invalid structure candle low");
  }

  const swingHighs: StructurePoint[] = [];
  const swingLows: StructurePoint[] = [];
  for (let index = swingWindow; index < candles.length - swingWindow; index += 1) {
    const candle = candles[index];
    const neighbors = candles.slice(index - swingWindow, index + swingWindow + 1);
    const otherHighs = neighbors.filter((_, offset) => offset !== swingWindow).map((item) => item.high);
    const otherLows = neighbors.filter((_, offset) => offset !== swingWindow).map((item) => item.low);
    if (candle.high > Math.max(...otherHighs)) {
      swingHighs.push({ index, price: candle.high, time: toIso(candle.openTime) });
    }
    if (candle.low < Math.min(...otherLows)) {
      swingLows.push({ index, price: candle.low, time: toIso(candle.openTime) });
    }
  }

  const recentHighs = swingHighs.slice(-8);
  const recentLows = swingLows.slice(-8);
  const currentPrice = candles.at(-1)!.close;
  const atr = averageTrueRange(candles);
  const tolerance = Math.max(atr * 0.35, currentPrice * 0.001);
  const reasons: string[] = [];

  let trend: MarketStructureAnalysis["trend"] = "range";
  let structureLabel: MarketStructureAnalysis["structureLabel"] = "INSUFFICIENT_SWINGS";
  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const previousHigh = recentHighs.at(-2)!.price;
    const latestHigh = recentHighs.at(-1)!.price;
    const previousLow = recentLows.at(-2)!.price;
    const latestLow = recentLows.at(-1)!.price;
    if (latestHigh > previousHigh && latestLow > previousLow) {
      trend = "bullish";
      structureLabel = "HH_HL";
      reasons.push("Recent swing structure is higher-high / higher-low");
    } else if (latestHigh < previousHigh && latestLow < previousLow) {
      trend = "bearish";
      structureLabel = "LH_LL";
      reasons.push("Recent swing structure is lower-high / lower-low");
    } else {
      trend = "transition";
      structureLabel = "MIXED";
      reasons.push("Recent swing highs and lows disagree, indicating transition or range conditions");
    }
  } else {
    reasons.push("Not enough confirmed swing points for directional structure classification");
  }

  const supports = uniqueLevels(recentLows.map((point) => point.price), tolerance)
    .filter((price) => price < currentPrice)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const resistances = uniqueLevels(recentHighs.map((point) => point.price), tolerance)
    .filter((price) => price > currentPrice)
    .sort((a, b) => a - b)
    .slice(0, 3);

  const previousResistance = recentHighs.at(-1)?.price ?? null;
  const previousSupport = recentLows.at(-1)?.price ?? null;
  let breakout: MarketStructureAnalysis["breakout"] = "none";
  if (previousResistance != null && currentPrice > previousResistance + tolerance * 0.15) {
    breakout = "bullish";
    reasons.push("Latest close is above the most recent confirmed swing high");
  } else if (previousSupport != null && currentPrice < previousSupport - tolerance * 0.15) {
    breakout = "bearish";
    reasons.push("Latest close is below the most recent confirmed swing low");
  }

  const liquidityReferences = [
    ...equalLevelReferences(recentHighs, tolerance, "equal_highs"),
    ...equalLevelReferences(recentLows, tolerance, "equal_lows"),
  ]
    .sort((a, b) => b.touches - a.touches)
    .slice(0, 4);

  if (supports[0] != null) reasons.push(`Nearest confirmed support is ${supports[0]}`);
  if (resistances[0] != null) reasons.push(`Nearest confirmed resistance is ${resistances[0]}`);
  if (liquidityReferences.length) {
    reasons.push("Repeated swing levels were detected as liquidity reference zones, not verified order-book liquidity");
  }

  return {
    version: "structure-v1",
    trend,
    structureLabel,
    breakout,
    currentPrice,
    atr,
    supportLevels: supports,
    resistanceLevels: resistances,
    nearestSupport: supports[0] ?? null,
    nearestResistance: resistances[0] ?? null,
    swingHighs: recentHighs,
    swingLows: recentLows,
    liquidityReferences,
    reasons,
  };
}
