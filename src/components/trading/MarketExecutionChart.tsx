import { useMemo, useState } from "react";

export type CandlePoint = {
  openTime: string;
  closeTime: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type Props = {
  symbol: string;
  timeframe: string;
  data: CandlePoint[];
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit1?: number | null;
  currentPrice?: number | null;
  liveEpoch?: number | null;
  liveConnected?: boolean;
  bid?: number | null;
  ask?: number | null;
};

type ChartMode = "candles" | "line";

function sma(values: number[], period: number) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const slice = values.slice(index + 1 - period, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function ema(values: number[], period: number) {
  if (!values.length) return [] as Array<number | null>;
  const alpha = 2 / (period + 1);
  let current = values[0];
  return values.map((value, index) => {
    current = index === 0 ? value : value * alpha + current * (1 - alpha);
    return index + 1 < period ? null : current;
  });
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atr(candles: CandlePoint[], period = 14) {
  if (candles.length <= period) return null;
  const recent = candles.slice(-period);
  const ranges = recent.map((candle, index) => {
    const previousClose = index === 0 ? candle.open : recent[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function MarketExecutionChart({
  symbol,
  timeframe,
  data,
  entryPrice,
  stopLoss,
  takeProfit1,
  currentPrice,
  liveEpoch,
  liveConnected = false,
  bid,
  ask,
}: Props) {
  const [mode, setMode] = useState<ChartMode>("candles");
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(false);
  const [showSma20, setShowSma20] = useState(false);

  const chartData = useMemo(() => {
    const rows = data.slice(-100).map((row) => ({ ...row }));
    if (!rows.length || currentPrice == null) return rows;
    const last = rows[rows.length - 1];
    const liveAt = liveEpoch ? liveEpoch * 1000 : Date.now();
    const closeAt = new Date(last.closeTime).getTime();
    if (Number.isFinite(closeAt) && liveAt <= closeAt + 2_000) {
      last.close = currentPrice;
      last.high = Math.max(last.high, currentPrice);
      last.low = Math.min(last.low, currentPrice);
    } else {
      rows.push({
        openTime: new Date(liveAt).toISOString(),
        closeTime: new Date(liveAt).toISOString(),
        label: new Date(liveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        open: last.close,
        high: Math.max(last.close, currentPrice),
        low: Math.min(last.close, currentPrice),
        close: currentPrice,
      });
    }
    return rows;
  }, [currentPrice, data, liveEpoch]);

  const closes = useMemo(() => chartData.map((row) => row.close), [chartData]);
  const ema20 = useMemo(() => ema(closes, 20), [closes]);
  const ema50 = useMemo(() => ema(closes, 50), [closes]);
  const sma20 = useMemo(() => sma(closes, 20), [closes]);
  const currentRsi = useMemo(() => rsi(closes), [closes]);
  const currentAtr = useMemo(() => atr(chartData), [chartData]);

  const width = 1000;
  const height = 430;
  const pad = { left: 72, right: 24, top: 20, bottom: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const priceBounds = useMemo(() => {
    const values = chartData.flatMap((row) => [row.low, row.high]);
    for (const extra of [entryPrice, stopLoss, takeProfit1, currentPrice]) {
      if (extra != null && Number.isFinite(extra)) values.push(extra);
    }
    if (!values.length) return { min: 0, max: 1 };
    let min = Math.min(...values);
    let max = Math.max(...values);
    const span = Math.max(max - min, Math.abs(max) * 0.002, 1e-6);
    min -= span * 0.08;
    max += span * 0.08;
    return { min, max };
  }, [chartData, currentPrice, entryPrice, stopLoss, takeProfit1]);

  const x = (index: number) =>
    pad.left + (chartData.length <= 1 ? plotWidth / 2 : (index / (chartData.length - 1)) * plotWidth);
  const y = (value: number) =>
    pad.top + ((priceBounds.max - value) / (priceBounds.max - priceBounds.min)) * plotHeight;
  const candleWidth = Math.max(3, Math.min(11, plotWidth / Math.max(chartData.length, 1) / 1.7));

  const linePath = (values: Array<number | null>) => {
    let path = "";
    values.forEach((value, index) => {
      if (value == null) return;
      path += `${path ? " L" : "M"}${x(index).toFixed(2)} ${y(value).toFixed(2)}`;
    });
    return path;
  };

  const renderLevel = (value: number | null | undefined, label: string) => {
    if (value == null || !Number.isFinite(value)) return null;
    const levelY = y(value);
    return (
      <g className="text-primary/70">
        <line x1={pad.left} x2={width - pad.right} y1={levelY} y2={levelY} stroke="currentColor" strokeDasharray="6 5" />
        <text x={width - pad.right - 4} y={levelY - 5} textAnchor="end" fill="currentColor" fontSize="11">
          {label} {formatPrice(value)}
        </text>
      </g>
    );
  };

  const movement =
    chartData.length >= 2 ? chartData[chartData.length - 1].close - chartData[chartData.length - 2].close : 0;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{symbol}</h2>
            <span className={`inline-flex items-center gap-1 text-[11px] ${liveConnected ? "text-primary" : "text-muted-foreground"}`}>
              <span className={`size-2 rounded-full ${liveConnected ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
              {liveConnected ? "LIVE" : "CONNECTING"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Execution chart · {timeframe}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right text-xs">
          <div><div className="text-muted-foreground">Bid</div><div className="font-mono">{formatPrice(bid)}</div></div>
          <div><div className="text-muted-foreground">Ask</div><div className="font-mono">{formatPrice(ask)}</div></div>
          <div><div className="text-muted-foreground">Live quote</div><div className="font-mono text-base font-semibold">{formatPrice(currentPrice)}</div></div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMode("candles")} className={`rounded-md border px-3 py-1.5 text-xs ${mode === "candles" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>Candles</button>
        <button type="button" onClick={() => setMode("line")} className={`rounded-md border px-3 py-1.5 text-xs ${mode === "line" ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>Line</button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" onClick={() => setShowEma20((value) => !value)} className={`rounded-md border px-3 py-1.5 text-xs ${showEma20 ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>EMA 20</button>
        <button type="button" onClick={() => setShowEma50((value) => !value)} className={`rounded-md border px-3 py-1.5 text-xs ${showEma50 ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>EMA 50</button>
        <button type="button" onClick={() => setShowSma20((value) => !value)} className={`rounded-md border px-3 py-1.5 text-xs ${showSma20 ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>SMA 20</button>
        <span className="ml-auto text-xs text-muted-foreground">RSI 14: <strong className="text-foreground">{currentRsi == null ? "—" : currentRsi.toFixed(1)}</strong> · ATR 14: <strong className="text-foreground">{currentAtr == null ? "—" : formatPrice(currentAtr)}</strong> · Move: <strong className={movement >= 0 ? "text-primary" : "text-destructive"}>{movement >= 0 ? "+" : ""}{formatPrice(movement)}</strong></span>
      </div>

      <div className="w-full overflow-hidden rounded-lg border border-border/70 bg-background">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-[430px] w-full" preserveAspectRatio="none" role="img" aria-label={`${symbol} ${mode} chart`}>
          {[0, 1, 2, 3, 4].map((grid) => {
            const value = priceBounds.max - ((priceBounds.max - priceBounds.min) * grid) / 4;
            const gridY = y(value);
            return (
              <g key={grid} className="text-muted-foreground/30">
                <line x1={pad.left} x2={width - pad.right} y1={gridY} y2={gridY} stroke="currentColor" strokeDasharray="4 5" />
                <text x={pad.left - 8} y={gridY + 4} textAnchor="end" fill="currentColor" fontSize="11">{formatPrice(value)}</text>
              </g>
            );
          })}

          {mode === "candles" ? chartData.map((candle, index) => {
            const up = candle.close >= candle.open;
            const cx = x(index);
            const bodyTop = y(Math.max(candle.open, candle.close));
            const bodyBottom = y(Math.min(candle.open, candle.close));
            const bodyHeight = Math.max(1.5, bodyBottom - bodyTop);
            return (
              <g key={`${candle.openTime}-${index}`} className={up ? "text-primary" : "text-destructive"}>
                <line x1={cx} x2={cx} y1={y(candle.high)} y2={y(candle.low)} stroke="currentColor" strokeWidth="1" />
                <rect x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill="currentColor" opacity={0.9} />
              </g>
            );
          }) : (
            <path d={linePath(closes)} fill="none" stroke="currentColor" strokeWidth="1.8" className="text-primary" />
          )}

          {showEma20 ? <path d={linePath(ema20)} fill="none" stroke="currentColor" strokeWidth="1.4" className="text-foreground/80" /> : null}
          {showEma50 ? <path d={linePath(ema50)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="5 4" className="text-muted-foreground" /> : null}
          {showSma20 ? <path d={linePath(sma20)} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" className="text-primary/60" /> : null}

          {renderLevel(entryPrice, "Entry")}
          {renderLevel(stopLoss, "SL")}
          {renderLevel(takeProfit1, "TP")}
          {renderLevel(currentPrice, "Live")}

          {chartData.filter((_, index) => index % Math.max(1, Math.floor(chartData.length / 6)) === 0).map((candle, filteredIndex, filtered) => {
            const index = chartData.indexOf(candle);
            return <text key={`${candle.openTime}-label-${filteredIndex}-${filtered.length}`} x={x(index)} y={height - 14} textAnchor="middle" className="fill-muted-foreground" fontSize="11">{candle.label}</text>;
          })}
        </svg>
      </div>
    </section>
  );
}
