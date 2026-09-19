import { useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Eye,
  EyeOff,
  Expand,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  PencilLine,
  RectangleHorizontal,
  Ruler,
  ScanLine,
  TextCursorInput,
  Trash2,
  Unlock,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { analyzeMarketStructure } from "@/lib/market-structure";
import { cn } from "@/lib/utils";

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
type Tool = "cursor" | "crosshair" | "hline" | "vline" | "trend" | "rectangle" | "fib" | "measure" | "text";
type DrawingPoint = { x: number; price: number };
type Drawing = {
  id: string;
  type: Exclude<Tool, "cursor" | "crosshair">;
  points: DrawingPoint[];
  text?: string;
};

const TOOL_META: Array<{ id: Tool; label: string; icon: typeof MousePointer2 }> = [
  { id: "cursor", label: "Cursor", icon: MousePointer2 },
  { id: "crosshair", label: "Crosshair", icon: Crosshair },
  { id: "hline", label: "Horizontal line", icon: MoveHorizontal },
  { id: "vline", label: "Vertical line", icon: MoveVertical },
  { id: "trend", label: "Trend line", icon: PencilLine },
  { id: "rectangle", label: "Rectangle / zone", icon: RectangleHorizontal },
  { id: "fib", label: "Fibonacci retracement", icon: ScanLine },
  { id: "measure", label: "Measure", icon: Ruler },
  { id: "text", label: "Text note", icon: TextCursorInput },
];

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

function drawingStorageKey(symbol: string, timeframe: string) {
  return `cossa-signals-drawings:${symbol}:${timeframe}`;
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
  const [showStructure, setShowStructure] = useState(true);
  const [tool, setTool] = useState<Tool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [draftPoint, setDraftPoint] = useState<DrawingPoint | null>(null);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [crosshair, setCrosshair] = useState<DrawingPoint | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(drawingStorageKey(symbol, timeframe));
      setDrawings(stored ? (JSON.parse(stored) as Drawing[]) : []);
    } catch {
      setDrawings([]);
    }
    setDraftPoint(null);
  }, [symbol, timeframe]);

  useEffect(() => {
    try {
      window.localStorage.setItem(drawingStorageKey(symbol, timeframe), JSON.stringify(drawings));
    } catch {
      // Drawing persistence is optional when storage is unavailable.
    }
  }, [drawings, symbol, timeframe]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const closedStructureInput = useMemo(() => data.slice(-visibleCount), [data, visibleCount]);
  const structure = useMemo(() => {
    if (closedStructureInput.length < 20) return null;
    try {
      return analyzeMarketStructure(closedStructureInput);
    } catch {
      return null;
    }
  }, [closedStructureInput]);

  const chartData = useMemo(() => {
    const rows = data.slice(-visibleCount).map((row) => ({ ...row }));
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
  }, [currentPrice, data, liveEpoch, visibleCount]);

  const closes = useMemo(() => chartData.map((row) => row.close), [chartData]);
  const ema20 = useMemo(() => ema(closes, 20), [closes]);
  const ema50 = useMemo(() => ema(closes, 50), [closes]);
  const sma20 = useMemo(() => sma(closes, 20), [closes]);
  const currentRsi = useMemo(() => rsi(closes), [closes]);
  const currentAtr = useMemo(() => atr(chartData), [chartData]);

  const width = 1200;
  const height = fullscreen ? 720 : 520;
  const pad = { left: 78, right: 30, top: 24, bottom: 44 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const priceBounds = useMemo(() => {
    const values = chartData.flatMap((row) => [row.low, row.high]);
    for (const extra of [entryPrice, stopLoss, takeProfit1, currentPrice]) {
      if (extra != null && Number.isFinite(extra)) values.push(extra);
    }
    if (drawingsVisible) {
      for (const drawing of drawings) {
        for (const point of drawing.points) values.push(point.price);
      }
    }
    if (showStructure && structure) {
      values.push(...structure.supportLevels, ...structure.resistanceLevels);
      values.push(...structure.liquidityReferences.map((reference) => reference.price));
    }
    if (!values.length) return { min: 0, max: 1 };
    let min = Math.min(...values);
    let max = Math.max(...values);
    const span = Math.max(max - min, Math.abs(max) * 0.002, 1e-6);
    min -= span * 0.08;
    max += span * 0.08;
    return { min, max };
  }, [chartData, currentPrice, drawings, drawingsVisible, entryPrice, showStructure, stopLoss, structure, takeProfit1]);

  const x = (index: number) =>
    pad.left + (chartData.length <= 1 ? plotWidth / 2 : (index / (chartData.length - 1)) * plotWidth);
  const xRatio = (ratio: number) => pad.left + Math.max(0, Math.min(1, ratio)) * plotWidth;
  const y = (value: number) =>
    pad.top + ((priceBounds.max - value) / (priceBounds.max - priceBounds.min)) * plotHeight;
  const priceFromY = (svgY: number) =>
    priceBounds.max - ((svgY - pad.top) / plotHeight) * (priceBounds.max - priceBounds.min);
  const candleWidth = Math.max(3, Math.min(12, plotWidth / Math.max(chartData.length, 1) / 1.7));

  const linePath = (values: Array<number | null>) => {
    let path = "";
    values.forEach((value, index) => {
      if (value == null) return;
      path += `${path ? " L" : "M"}${x(index).toFixed(2)} ${y(value).toFixed(2)}`;
    });
    return path;
  };

  function pointerToPoint(event: React.PointerEvent<SVGSVGElement>): DrawingPoint | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const svgY = ((event.clientY - rect.top) / rect.height) * height;
    if (svgX < pad.left || svgX > width - pad.right || svgY < pad.top || svgY > height - pad.bottom) return null;
    return {
      x: (svgX - pad.left) / plotWidth,
      price: priceFromY(svgY),
    };
  }

  function finishSinglePoint(type: "hline" | "vline" | "text", point: DrawingPoint) {
    const drawing: Drawing = { id: crypto.randomUUID(), type, points: [point] };
    if (type === "text") {
      const note = window.prompt("Chart note");
      if (!note?.trim()) return;
      drawing.text = note.trim();
    }
    setDrawings((rows) => [...rows, drawing]);
  }

  function onChartPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = pointerToPoint(event);
    if (!point) return;
    if (tool === "crosshair") {
      setCrosshair(point);
      return;
    }
    if (tool === "cursor" || drawingsLocked) return;
    if (tool === "hline" || tool === "vline" || tool === "text") {
      finishSinglePoint(tool, point);
      return;
    }
    if (!draftPoint) {
      setDraftPoint(point);
      return;
    }
    setDrawings((rows) => [
      ...rows,
      { id: crypto.randomUUID(), type: tool as Drawing["type"], points: [draftPoint, point] },
    ]);
    setDraftPoint(null);
  }

  function onChartPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (tool !== "crosshair") return;
    setCrosshair(pointerToPoint(event));
  }

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

  const renderStructureLevel = (
    value: number,
    label: string,
    kind: "support" | "resistance" | "reference",
  ) => {
    const levelY = y(value);
    const className =
      kind === "support"
        ? "text-primary/45"
        : kind === "resistance"
          ? "text-destructive/45"
          : "text-muted-foreground/45";
    return (
      <g key={`${kind}-${label}-${value}`} className={className}>
        <line x1={pad.left} x2={width - pad.right} y1={levelY} y2={levelY} stroke="currentColor" strokeDasharray={kind === "reference" ? "2 4" : "8 5"} />
        <text x={pad.left + 5} y={levelY - 4} fill="currentColor" fontSize="10">
          {label} {formatPrice(value)}
        </text>
      </g>
    );
  };

  function renderDrawing(drawing: Drawing) {
    const first = drawing.points[0];
    const second = drawing.points[1];
    if (!first) return null;
    const x1 = xRatio(first.x);
    const y1 = y(first.price);
    const x2 = second ? xRatio(second.x) : x1;
    const y2 = second ? y(second.price) : y1;

    if (drawing.type === "hline") {
      return <g key={drawing.id} className="text-caution"><line x1={pad.left} x2={width - pad.right} y1={y1} y2={y1} stroke="currentColor" strokeWidth="1.3"/><text x={width - pad.right - 4} y={y1 - 5} textAnchor="end" fill="currentColor" fontSize="10">H {formatPrice(first.price)}</text></g>;
    }
    if (drawing.type === "vline") {
      return <line key={drawing.id} x1={x1} x2={x1} y1={pad.top} y2={height - pad.bottom} stroke="currentColor" strokeDasharray="4 4" className="text-caution/80" />;
    }
    if (drawing.type === "trend") {
      return <line key={drawing.id} x1={x1} x2={x2} y1={y1} y2={y2} stroke="currentColor" strokeWidth="1.6" className="text-caution" />;
    }
    if (drawing.type === "rectangle") {
      return <rect key={drawing.id} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill="currentColor" fillOpacity="0.09" stroke="currentColor" strokeWidth="1.2" className="text-caution" />;
    }
    if (drawing.type === "fib") {
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 1];
      return (
        <g key={drawing.id} className="text-caution/80">
          {levels.map((level) => {
            const price = first.price + (second!.price - first.price) * level;
            const levelY = y(price);
            return <g key={level}><line x1={Math.min(x1, x2)} x2={Math.max(x1, x2)} y1={levelY} y2={levelY} stroke="currentColor"/><text x={Math.max(x1, x2) + 5} y={levelY + 3} fill="currentColor" fontSize="9">{(level * 100).toFixed(1)}%</text></g>;
          })}
        </g>
      );
    }
    if (drawing.type === "measure") {
      const delta = second!.price - first.price;
      const pct = first.price === 0 ? 0 : (delta / first.price) * 100;
      return <g key={drawing.id} className="text-primary"><line x1={x1} x2={x2} y1={y1} y2={y2} stroke="currentColor" strokeDasharray="4 3"/><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" fill="currentColor" fontSize="10">Δ {formatPrice(delta)} · {pct.toFixed(2)}%</text></g>;
    }
    if (drawing.type === "text") {
      return <text key={drawing.id} x={x1} y={y1} fill="currentColor" fontSize="12" className="text-caution">{drawing.text}</text>;
    }
    return null;
  }

  const movement = chartData.length >= 2
    ? chartData[chartData.length - 1].close - chartData[chartData.length - 2].close
    : 0;

  return (
    <section
      className={cn(
        "border bg-card",
        fullscreen
          ? "fixed inset-0 z-[100] overflow-auto rounded-none bg-background p-3"
          : "rounded-lg p-3",
      )}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{symbol}</h2>
            <span className={cn("inline-flex items-center gap-1 text-[11px]", liveConnected ? "text-primary" : "text-muted-foreground")}>
              <span className={cn("size-2 rounded-full", liveConnected ? "animate-pulse bg-primary" : "bg-muted-foreground")} />
              {liveConnected ? "LIVE" : "CONNECTING"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Execution chart · {timeframe}</p>
        </div>
        <div className="flex items-center gap-3 text-right text-[11px]">
          <div><div className="text-muted-foreground">Bid</div><div className="font-mono">{formatPrice(bid)}</div></div>
          <div><div className="text-muted-foreground">Ask</div><div className="font-mono">{formatPrice(ask)}</div></div>
          <div><div className="text-muted-foreground">Live</div><div className="font-mono text-sm font-semibold">{formatPrice(currentPrice)}</div></div>
          <button type="button" onClick={() => setFullscreen((value) => !value)} title={fullscreen ? "Exit fullscreen" : "Fullscreen chart"} className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground">
            {fullscreen ? <Minus className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5 border-y border-border/70 py-2">
        <button type="button" onClick={() => setMode("candles")} className={cn("rounded px-2 py-1 text-[11px]", mode === "candles" ? "bg-primary/15 text-primary" : "text-muted-foreground")}>Candles</button>
        <button type="button" onClick={() => setMode("line")} className={cn("rounded px-2 py-1 text-[11px]", mode === "line" ? "bg-primary/15 text-primary" : "text-muted-foreground")}>Line</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => setShowEma20((value) => !value)} className={cn("rounded px-2 py-1 text-[11px]", showEma20 ? "bg-primary/15 text-primary" : "text-muted-foreground")}>EMA20</button>
        <button type="button" onClick={() => setShowEma50((value) => !value)} className={cn("rounded px-2 py-1 text-[11px]", showEma50 ? "bg-primary/15 text-primary" : "text-muted-foreground")}>EMA50</button>
        <button type="button" onClick={() => setShowSma20((value) => !value)} className={cn("rounded px-2 py-1 text-[11px]", showSma20 ? "bg-primary/15 text-primary" : "text-muted-foreground")}>SMA20</button>
        <button type="button" onClick={() => setShowStructure((value) => !value)} className={cn("rounded px-2 py-1 text-[11px]", showStructure ? "bg-primary/15 text-primary" : "text-muted-foreground")}>Structure</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => setVisibleCount((value) => Math.max(30, value - 20))} title="Zoom in" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ZoomIn className="size-3.5" /></button>
        <button type="button" onClick={() => setVisibleCount((value) => Math.min(180, value + 20))} title="Zoom out" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ZoomOut className="size-3.5" /></button>
        <button type="button" onClick={() => setVisibleCount(100)} title="Fit chart" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Expand className="size-3.5" /></button>
        <span className="ml-auto text-[11px] text-muted-foreground">RSI <strong className="text-foreground">{currentRsi == null ? "—" : currentRsi.toFixed(1)}</strong> · ATR <strong className="text-foreground">{currentAtr == null ? "—" : formatPrice(currentAtr)}</strong> · Move <strong className={movement >= 0 ? "text-primary" : "text-destructive"}>{movement >= 0 ? "+" : ""}{formatPrice(movement)}</strong></span>
      </div>

      {showStructure && structure ? (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 rounded-md border border-border/70 px-3 py-2 text-[10px] text-muted-foreground">
          <span>Structure <strong className="text-foreground">{structure.trend.toUpperCase()} · {structure.structureLabel}</strong></span>
          <span>Breakout <strong className="text-foreground">{structure.breakout.toUpperCase()}</strong></span>
          <span>Support <strong className="text-foreground">{formatPrice(structure.nearestSupport)}</strong></span>
          <span>Resistance <strong className="text-foreground">{formatPrice(structure.nearestResistance)}</strong></span>
          <span>EQ refs <strong className="text-foreground">{structure.liquidityReferences.length}</strong></span>
        </div>
      ) : null}

      <div className="grid grid-cols-[42px_minmax(0,1fr)] overflow-hidden rounded-md border border-border/70 bg-background">
        <div className="flex flex-col items-center gap-1 border-r border-border/70 bg-card/70 py-2">
          {TOOL_META.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" title={item.label} aria-label={item.label} onClick={() => { setTool(item.id); setDraftPoint(null); }} className={cn("rounded p-2 transition-colors", tool === item.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="size-4" />
              </button>
            );
          })}
          <div className="my-1 h-px w-6 bg-border" />
          <button type="button" title={drawingsVisible ? "Hide drawings" : "Show drawings"} onClick={() => setDrawingsVisible((value) => !value)} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            {drawingsVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
          <button type="button" title={drawingsLocked ? "Unlock drawings" : "Lock drawings"} onClick={() => setDrawingsLocked((value) => !value)} className={cn("rounded p-2 hover:bg-muted", drawingsLocked ? "text-primary" : "text-muted-foreground")}>
            {drawingsLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          </button>
          <button type="button" title="Clear drawings" onClick={() => { if (window.confirm("Clear all drawings for this market and timeframe?")) setDrawings([]); }} className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="relative min-w-0">
          {draftPoint ? (
            <div className="absolute left-3 top-3 z-10 rounded bg-background/90 px-2 py-1 text-[10px] text-caution shadow">Select second point · Esc/change tool to cancel</div>
          ) : null}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className={cn("block w-full select-none", fullscreen ? "h-[calc(100vh-160px)] min-h-[620px]" : "h-[58vh] min-h-[480px]")}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${symbol} ${mode} chart`}
            onPointerDown={onChartPointerDown}
            onPointerMove={onChartPointerMove}
            onPointerLeave={() => tool === "crosshair" && setCrosshair(null)}
          >
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

            {showStructure && structure ? (
              <>
                {structure.supportLevels.slice(0, 2).map((value, index) => renderStructureLevel(value, `S${index + 1}`, "support"))}
                {structure.resistanceLevels.slice(0, 2).map((value, index) => renderStructureLevel(value, `R${index + 1}`, "resistance"))}
                {structure.liquidityReferences.slice(0, 3).map((reference) => renderStructureLevel(reference.price, reference.kind === "equal_highs" ? `EQH×${reference.touches}` : `EQL×${reference.touches}`, "reference"))}
              </>
            ) : null}

            {mode === "candles" ? chartData.map((candle, index) => {
              const up = candle.close >= candle.open;
              const cx = x(index);
              const bodyTop = y(Math.max(candle.open, candle.close));
              const bodyBottom = y(Math.min(candle.open, candle.close));
              const bodyHeight = Math.max(1.5, bodyBottom - bodyTop);
              return (
                <g key={`${candle.openTime}-${index}`} className={up ? "text-primary" : "text-destructive"}>
                  <line x1={cx} x2={cx} y1={y(candle.high)} y2={y(candle.low)} stroke="currentColor" strokeWidth="1" />
                  <rect x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill="currentColor" opacity={0.92} />
                </g>
              );
            }) : (
              <path d={linePath(closes)} fill="none" stroke="currentColor" strokeWidth="1.8" className="text-primary" />
            )}

            {showEma20 ? <path d={linePath(ema20)} fill="none" stroke="currentColor" strokeWidth="1.4" className="text-foreground/80" /> : null}
            {showEma50 ? <path d={linePath(ema50)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="5 4" className="text-muted-foreground" /> : null}
            {showSma20 ? <path d={linePath(sma20)} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" className="text-primary/60" /> : null}

            {showStructure && structure ? (
              <>
                {structure.swingHighs.slice(-6).map((point) => <circle key={`swing-high-${point.index}-${point.price}`} cx={x(point.index)} cy={y(point.price)} r="3" className="fill-destructive/70" />)}
                {structure.swingLows.slice(-6).map((point) => <circle key={`swing-low-${point.index}-${point.price}`} cx={x(point.index)} cy={y(point.price)} r="3" className="fill-primary/70" />)}
              </>
            ) : null}

            {renderLevel(entryPrice, "Entry")}
            {renderLevel(stopLoss, "SL")}
            {renderLevel(takeProfit1, "TP")}
            {renderLevel(currentPrice, "Live")}

            {drawingsVisible ? drawings.map(renderDrawing) : null}

            {crosshair && tool === "crosshair" ? (
              <g className="text-muted-foreground/80">
                <line x1={xRatio(crosshair.x)} x2={xRatio(crosshair.x)} y1={pad.top} y2={height - pad.bottom} stroke="currentColor" strokeDasharray="3 3" />
                <line x1={pad.left} x2={width - pad.right} y1={y(crosshair.price)} y2={y(crosshair.price)} stroke="currentColor" strokeDasharray="3 3" />
                <rect x={width - pad.right - 88} y={y(crosshair.price) - 11} width="84" height="18" rx="3" className="fill-background stroke-border" />
                <text x={width - pad.right - 8} y={y(crosshair.price) + 2} textAnchor="end" fill="currentColor" fontSize="10">{formatPrice(crosshair.price)}</text>
              </g>
            ) : null}

            {chartData.filter((_, index) => index % Math.max(1, Math.floor(chartData.length / 6)) === 0).map((candle, filteredIndex, filtered) => {
              const index = chartData.indexOf(candle);
              return <text key={`${candle.openTime}-label-${filteredIndex}-${filtered.length}`} x={x(index)} y={height - 14} textAnchor="middle" className="fill-muted-foreground" fontSize="11">{candle.label}</text>;
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}
