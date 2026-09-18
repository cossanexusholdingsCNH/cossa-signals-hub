export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  openTime?: string | Date;
};

export type SignalDirection = "buy" | "sell" | "wait";
export type MarketRegime =
  "trending_up" | "trending_down" | "ranging" | "high_volatility" | "unknown";

export type IndicatorSnapshot = {
  rsi14: number;
  ema20: number;
  ema50: number;
  atr14: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
};

export type TradePlan = {
  direction: SignalDirection;
  regime: MarketRegime;
  confidence: number;
  entry: number | null;
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  riskRewardRatio: number | null;
  indicators: IndicatorSnapshot;
  reasons: string[];
  noTradeReasons: string[];
};

const finite = (n: number) => Number.isFinite(n);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function validateCandles(candles: Candle[]) {
  if (candles.length < 60) throw new Error("At least 60 closed candles are required");
  for (const c of candles) {
    if (![c.open, c.high, c.low, c.close].every(finite))
      throw new Error("Candle contains a non-finite price");
    if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0)
      throw new Error("Candle prices must be positive");
    if (c.high < Math.max(c.open, c.close, c.low) || c.low > Math.min(c.open, c.close, c.high)) {
      throw new Error("Invalid OHLC candle invariant");
    }
  }
}

export function ema(values: number[], period: number): number[] {
  if (period < 2 || values.length < period) throw new Error("Insufficient values for EMA");
  const multiplier = 2 / (period + 1);
  const out = Array(values.length).fill(Number.NaN) as number[];
  let previous = mean(values.slice(0, period));
  out[period - 1] = previous;
  for (let i = period; i < values.length; i += 1) {
    previous = (values[i] - previous) * multiplier + previous;
    out[i] = previous;
  }
  return out;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) throw new Error("Insufficient values for RSI");
  const slice = values.slice(-(period + 1));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i += 1) {
    const change = slice[i] - slice[i - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) throw new Error("Insufficient candles for ATR");
  const recent = candles.slice(-(period + 1));
  const trueRanges: number[] = [];
  for (let i = 1; i < recent.length; i += 1) {
    const c = recent[i];
    const previousClose = recent[i - 1].close;
    trueRanges.push(
      Math.max(c.high - c.low, Math.abs(c.high - previousClose), Math.abs(c.low - previousClose)),
    );
  }
  return mean(trueRanges);
}

export function macd(values: number[]) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  const line = values.map((_, i) =>
    finite(fast[i]) && finite(slow[i]) ? fast[i] - slow[i] : Number.NaN,
  );
  const validLine = line.filter(finite);
  const signalSeries = ema(validLine, 9);
  const macdValue = validLine.at(-1)!;
  const signal = signalSeries.at(-1)!;
  return { macd: macdValue, signal, histogram: macdValue - signal };
}

export function buildTradePlan(candles: Candle[]): TradePlan {
  validateCandles(candles);
  const closes = candles.map((c) => c.close);
  const ema20 = ema(closes, 20).at(-1)!;
  const ema50 = ema(closes, 50).at(-1)!;
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);
  const m = macd(closes);
  const current = closes.at(-1)!;
  const atrPct = (atr14 / current) * 100;
  const trendDistancePct = (Math.abs(ema20 - ema50) / current) * 100;
  const recentLookback = Math.min(20, closes.length - 1);
  const recentStart = closes[closes.length - 1 - recentLookback];
  const recentMovePct = ((current - recentStart) / recentStart) * 100;

  let regime: MarketRegime = "ranging";
  if (atrPct >= 2.5) regime = "high_volatility";
  else if (trendDistancePct >= 0.18) regime = ema20 >= ema50 ? "trending_up" : "trending_down";

  let bullScore = 0;
  let bearScore = 0;
  const reasons: string[] = [];
  const noTradeReasons: string[] = [];

  if (ema20 > ema50) {
    bullScore += 2;
    reasons.push("EMA20 is above EMA50");
  }
  if (ema20 < ema50) {
    bearScore += 2;
    reasons.push("EMA20 is below EMA50");
  }
  if (m.histogram > 0) {
    bullScore += 1;
    reasons.push("MACD histogram is positive");
  }
  if (m.histogram < 0) {
    bearScore += 1;
    reasons.push("MACD histogram is negative");
  }
  if (rsi14 >= 52 && rsi14 <= 70) {
    bullScore += 1;
    reasons.push("RSI supports bullish momentum without extreme overbought conditions");
  }
  if (rsi14 <= 48 && rsi14 >= 30) {
    bearScore += 1;
    reasons.push("RSI supports bearish momentum without extreme oversold conditions");
  }
  if (current > ema20) bullScore += 1;
  if (current < ema20) bearScore += 1;

  if (rsi14 > 75 && recentMovePct < 1)
    noTradeReasons.push("RSI is extremely overbought without sufficient recent trend confirmation");
  if (rsi14 < 25 && recentMovePct > -1)
    noTradeReasons.push("RSI is extremely oversold without sufficient recent trend confirmation");
  if (atrPct > 5) noTradeReasons.push("ATR volatility exceeds safety threshold");

  if (
    regime === "ranging" &&
    (Math.abs(bullScore - bearScore) < 3 || Math.abs(recentMovePct) < 0.5)
  ) {
    noTradeReasons.push("Ranging regime has insufficient directional edge");
  }

  const edge = bullScore - bearScore;
  let direction: SignalDirection = "wait";
  if (noTradeReasons.length === 0 && edge >= 3) direction = "buy";
  if (noTradeReasons.length === 0 && edge <= -3) direction = "sell";

  const confidence = Math.min(
    95,
    Math.max(0, 50 + Math.abs(edge) * 8 - (regime === "high_volatility" ? 10 : 0)),
  );
  if (direction === "wait") {
    return {
      direction,
      regime,
      confidence,
      entry: null,
      entryZoneLow: null,
      entryZoneHigh: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      takeProfit3: null,
      riskRewardRatio: null,
      indicators: {
        rsi14,
        ema20,
        ema50,
        atr14,
        macd: m.macd,
        macdSignal: m.signal,
        macdHistogram: m.histogram,
      },
      reasons,
      noTradeReasons: noTradeReasons.length
        ? noTradeReasons
        : ["Directional score did not meet minimum threshold"],
    };
  }

  const riskDistance = atr14 * 1.5;
  const entryZoneHalfWidth = atr14 * 0.15;
  const sign = direction === "buy" ? 1 : -1;
  const stopLoss = current - sign * riskDistance;
  const takeProfit1 = current + sign * riskDistance;
  const takeProfit2 = current + sign * riskDistance * 2;
  const takeProfit3 = current + sign * riskDistance * 3;

  return {
    direction,
    regime,
    confidence,
    entry: current,
    entryZoneLow: current - entryZoneHalfWidth,
    entryZoneHigh: current + entryZoneHalfWidth,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskRewardRatio: 3,
    indicators: {
      rsi14,
      ema20,
      ema50,
      atr14,
      macd: m.macd,
      macdSignal: m.signal,
      macdHistogram: m.histogram,
    },
    reasons,
    noTradeReasons,
  };
}
