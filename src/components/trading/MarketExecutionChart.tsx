import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
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
  Undo2,
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
  liveReceivedAtMs?: number | null;
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

type DrawingEdit = {
  drawingId: string;
  handleIndex: number | null;
  start: DrawingPoint;
  original: Drawing;
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
  return `cossa-signals-drawings-v2:${symbol}:${timeframe}`;
}

function legacyDrawingStorageKey(symbol: string, timeframe: string) {
  return `cossa-signals-drawings:${symbol}:${timeframe}`;
}

function timeframeMilliseconds(timeframe: string) {
  switch (timeframe) {
    case "1m": return 60_000;
    case "5m": return 5 * 60_000;
    case "15m": return 15 * 60_000;
    case "30m": return 30 * 60_000;
    case "1h": return 60 * 60_000;
    case "4h": return 4 * 60 * 60_000;
    default: return 5 * 60_000;
  }
}

function humanDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
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
  liveReceivedAtMs = null,
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
  const [drawingsLoaded, setDrawingsLoaded] = useState(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [editingDrawing, setEditingDrawing] = useState<DrawingEdit | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<DrawingPoint | null>(null);
  const [dragPoint, setDragPoint] = useState<DrawingPoint | null>(null);
  const [hoverPoint, setHoverPoint] = useState<DrawingPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panning, setPanning] = useState(false);
  const [panOffset, setPanOffset] = useState(0);
  const panOriginRef = useRef<{ clientX: number; offset: number } | null>(null);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [liveBuckets, setLiveBuckets] = useState<CandlePoint[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    setDrawingsLoaded(false);
    setDrawings([]);
    setSelectedDrawingId(null);
    setEditingDrawing(null);
    setAnchorPoint(null);
    setDragPoint(null);
    setHoverPoint(null);
    setDragging(false);
    setPanning(false);
    setPanOffset(0);
    setLiveBuckets([]);
  }, [symbol, timeframe]);

  useEffect(() => {
    if (drawingsLoaded || data.length === 0) return;
    try {
      const current = window.localStorage.getItem(drawingStorageKey(symbol, timeframe));
      const legacy = current ? null : window.localStorage.getItem(legacyDrawingStorageKey(symbol, timeframe));
      const parsed = JSON.parse(current ?? legacy ?? "[]") as Drawing[];
      const legacyRows = data.slice(-100);
      const migrated = parsed.map((drawing) => ({
        ...drawing,
        points: drawing.points.map((point) => {
          if (point.x > 10_000_000_000) return point;
          if (!legacyRows.length) return point;
          const ratio = Math.max(0, Math.min(1, point.x));
          const index = Math.max(0, Math.min(legacyRows.length - 1, Math.round(ratio * (legacyRows.length - 1))));
          const time = new Date(legacyRows[index].openTime).getTime();
          return { x: Number.isFinite(time) ? time : Date.now(), price: point.price };
        }),
      }));
      setDrawings(migrated);
      if (!current && legacy) {
        window.localStorage.setItem(drawingStorageKey(symbol, timeframe), JSON.stringify(migrated));
      }
    } catch {
      setDrawings([]);
    }
    setDrawingsLoaded(true);
  }, [data, drawingsLoaded, symbol, timeframe]);

  useEffect(() => {
    if (!drawingsLoaded) return;
    try {
      window.localStorage.setItem(drawingStorageKey(symbol, timeframe), JSON.stringify(drawings));
    } catch {
      // Drawing persistence is optional when storage is unavailable.
    }
  }, [drawings, drawingsLoaded, symbol, timeframe]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAnchorPoint(null);
        setDragPoint(null);
        setDragging(false);
        setPanning(false);
        setEditingDrawing(null);
        setSelectedDrawingId(null);
        if (fullscreen) setFullscreen(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setDrawings((rows) => rows.slice(0, -1));
        setSelectedDrawingId(null);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedDrawingId && !drawingsLocked) {
        event.preventDefault();
        setDrawings((rows) => rows.filter((drawing) => drawing.id !== selectedDrawingId));
        setSelectedDrawingId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawingsLocked, fullscreen, selectedDrawingId]);

  const intervalMs = useMemo(() => timeframeMilliseconds(timeframe), [timeframe]);

  useEffect(() => {
    if (currentPrice == null || !Number.isFinite(currentPrice) || !liveEpoch) return;
    const liveAt = liveEpoch * 1000;
    const bucketStart = Math.floor(liveAt / intervalMs) * intervalMs;
    const storedCloseAt = data.length ? new Date(data[data.length - 1].closeTime).getTime() : 0;
    if (bucketStart + intervalMs <= storedCloseAt + 1_000) return;

    setLiveBuckets((rows) => {
      const openTime = new Date(bucketStart).toISOString();
      const closeTime = new Date(bucketStart + intervalMs).toISOString();
      const existingIndex = rows.findIndex((row) => row.openTime === openTime);
      if (existingIndex >= 0) {
        const next = [...rows];
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          high: Math.max(existing.high, currentPrice),
          low: Math.min(existing.low, currentPrice),
          close: currentPrice,
        };
        return next;
      }

      const previousClose = rows.at(-1)?.close ?? data.at(-1)?.close ?? currentPrice;
      return [
        ...rows,
        {
          openTime,
          closeTime,
          label: new Date(bucketStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          open: previousClose,
          high: Math.max(previousClose, currentPrice),
          low: Math.min(previousClose, currentPrice),
          close: currentPrice,
        },
      ].slice(-80);
    });
  }, [currentPrice, data, intervalMs, liveEpoch]);

  const allChartData = useMemo(() => {
    const rows = new Map<string, CandlePoint>();
    for (const row of data) rows.set(row.openTime, { ...row });
    for (const row of liveBuckets) {
      if (!rows.has(row.openTime)) rows.set(row.openTime, { ...row });
    }
    return [...rows.values()].sort(
      (a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime(),
    );
  }, [data, liveBuckets]);

  const maxPanOffset = Math.max(0, allChartData.length - Math.min(visibleCount, allChartData.length));
  const chartData = useMemo(() => {
    const end = Math.max(0, allChartData.length - Math.min(panOffset, maxPanOffset));
    const start = Math.max(0, end - Math.max(12, visibleCount));
    return allChartData.slice(start, end);
  }, [allChartData, maxPanOffset, panOffset, visibleCount]);

  useEffect(() => {
    setPanOffset((value) => Math.min(value, maxPanOffset));
    setVisibleCount((value) => Math.max(12, Math.min(value, Math.max(12, allChartData.length || 12))));
  }, [allChartData.length, maxPanOffset]);

  const closedStructureInput = useMemo(
    () => chartData.filter((row) => new Date(row.closeTime).getTime() <= Date.now() + 1_000),
    [chartData],
  );
  const structure = useMemo(() => {
    if (closedStructureInput.length < 20) return null;
    try {
      return analyzeMarketStructure(closedStructureInput);
    } catch {
      return null;
    }
  }, [closedStructureInput]);

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
  const rightSpaceBars = 8;
  const horizontalSlots = Math.max(chartData.length - 1 + rightSpaceBars, 1);
  const firstVisibleTime = chartData.length ? new Date(chartData[0].openTime).getTime() : Date.now();
  const lastVisibleTime = chartData.length ? new Date(chartData[chartData.length - 1].openTime).getTime() : firstVisibleTime;

  const priceBounds = useMemo(() => {
    const values = chartData.flatMap((row) => [row.low, row.high]);
    if (panOffset === 0) {
      for (const extra of [entryPrice, stopLoss, takeProfit1, currentPrice]) {
        if (extra != null && Number.isFinite(extra)) values.push(extra);
      }
    }
    if (drawingsVisible) {
      for (const drawing of drawings) {
        const drawingStart = Math.min(...drawing.points.map((point) => point.x));
        const drawingEnd = Math.max(...drawing.points.map((point) => point.x));
        const intersectsViewport = drawing.type === "hline" ||
          (drawingEnd >= firstVisibleTime - intervalMs && drawingStart <= lastVisibleTime + rightSpaceBars * intervalMs);
        if (!intersectsViewport) continue;
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
  }, [chartData, currentPrice, drawings, drawingsVisible, entryPrice, firstVisibleTime, intervalMs, lastVisibleTime, panOffset, showStructure, stopLoss, structure, takeProfit1]);

  const x = (index: number) => pad.left + (index / horizontalSlots) * plotWidth;
  const xTime = (time: number) => pad.left + (((time - firstVisibleTime) / intervalMs) / horizontalSlots) * plotWidth;
  const y = (value: number) =>
    pad.top + ((priceBounds.max - value) / (priceBounds.max - priceBounds.min)) * plotHeight;
  const priceFromY = (svgY: number) =>
    priceBounds.max - ((svgY - pad.top) / plotHeight) * (priceBounds.max - priceBounds.min);
  const candleWidth = Math.max(2.5, Math.min(14, plotWidth / Math.max(horizontalSlots + 1, 1) / 1.55));

  const linePath = (values: Array<number | null>) => {
    let path = "";
    values.forEach((value, index) => {
      if (value == null) return;
      path += `${path ? " L" : "M"}${x(index).toFixed(2)} ${y(value).toFixed(2)}`;
    });
    return path;
  };

  function pointerToPoint(event: React.PointerEvent<SVGElement>): DrawingPoint | null {
    const svg = svgRef.current;
    if (!svg || chartData.length === 0) return null;
    const rect = svg.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const svgY = ((event.clientY - rect.top) / rect.height) * height;
    if (svgX < pad.left || svgX > width - pad.right || svgY < pad.top || svgY > height - pad.bottom) return null;
    const rawIndex = ((svgX - pad.left) / plotWidth) * horizontalSlots;
    const snappedIndex = event.shiftKey ? rawIndex : Math.round(rawIndex);
    return {
      x: firstVisibleTime + snappedIndex * intervalMs,
      price: priceFromY(svgY),
    };
  }

  function cancelInteraction() {
    setAnchorPoint(null);
    setDragPoint(null);
    setDragging(false);
    setPanning(false);
    panOriginRef.current = null;
    setEditingDrawing(null);
  }

  function finishSinglePoint(type: "hline" | "vline" | "text", point: DrawingPoint) {
    const drawing: Drawing = { id: crypto.randomUUID(), type, points: [point] };
    if (type === "text") {
      const note = window.prompt("Chart note");
      if (!note?.trim()) return;
      drawing.text = note.trim();
    }
    setDrawings((rows) => [...rows, drawing]);
    setSelectedDrawingId(drawing.id);
    setTool("cursor");
  }

  function commitTwoPointDrawing(first: DrawingPoint, second: DrawingPoint) {
    if (tool !== "trend" && tool !== "rectangle" && tool !== "fib" && tool !== "measure") return;
    const drawing: Drawing = { id: crypto.randomUUID(), type: tool, points: [first, second] };
    setDrawings((rows) => [...rows, drawing]);
    setSelectedDrawingId(drawing.id);
    cancelInteraction();
    setTool("cursor");
  }

  function interactionDistance(first: DrawingPoint, second: DrawingPoint) {
    const dx = xTime(second.x) - xTime(first.x);
    const dy = y(second.price) - y(first.price);
    return Math.hypot(dx, dy);
  }

  function startDrawingEdit(
    event: React.PointerEvent<SVGElement>,
    drawing: Drawing,
    handleIndex: number | null,
  ) {
    if (tool !== "cursor" || drawingsLocked) return;
    const point = pointerToPoint(event);
    if (!point) return;
    event.stopPropagation();
    setSelectedDrawingId(drawing.id);
    setEditingDrawing({
      drawingId: drawing.id,
      handleIndex,
      start: point,
      original: { ...drawing, points: drawing.points.map((item) => ({ ...item })) },
    });
    try {
      svgRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Editing still works without pointer capture.
    }
  }

  function onChartPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = pointerToPoint(event);
    if (!point) return;
    setHoverPoint(point);
    if (tool === "crosshair") return;
    if (tool === "cursor") {
      setSelectedDrawingId(null);
      setPanning(true);
      panOriginRef.current = { clientX: event.clientX, offset: panOffset };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional.
      }
      return;
    }
    if (drawingsLocked) return;
    if (tool === "hline" || tool === "vline" || tool === "text") {
      finishSinglePoint(tool, point);
      return;
    }
    if (anchorPoint) {
      commitTwoPointDrawing(anchorPoint, point);
      return;
    }
    setAnchorPoint(point);
    setDragPoint(point);
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; click-click drawing still works without it.
    }
  }

  function onChartPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = pointerToPoint(event);
    setHoverPoint(point);

    if (editingDrawing && point) {
      setDrawings((rows) =>
        rows.map((drawing) => {
          if (drawing.id !== editingDrawing.drawingId) return drawing;
          if (editingDrawing.handleIndex != null) {
            const points = drawing.points.map((item) => ({ ...item }));
            points[editingDrawing.handleIndex] = point;
            return { ...drawing, points };
          }
          const deltaTime = point.x - editingDrawing.start.x;
          const deltaPrice = point.price - editingDrawing.start.price;
          return {
            ...drawing,
            points: editingDrawing.original.points.map((item) => ({
              x: item.x + deltaTime,
              price: item.price + deltaPrice,
            })),
          };
        }),
      );
      return;
    }

    if (panning && panOriginRef.current) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const plotPixelWidth = rect.width * (plotWidth / width);
        const pixelsPerBar = Math.max(2, plotPixelWidth / horizontalSlots);
        const bars = Math.round((event.clientX - panOriginRef.current.clientX) / pixelsPerBar);
        setPanOffset(Math.max(0, Math.min(maxPanOffset, panOriginRef.current.offset + bars)));
      }
      return;
    }

    if (dragging && anchorPoint && point) setDragPoint(point);
  }

  function onChartPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (editingDrawing) {
      setEditingDrawing(null);
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* optional */ }
      return;
    }
    if (panning) {
      setPanning(false);
      panOriginRef.current = null;
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* optional */ }
      return;
    }
    if (!dragging || !anchorPoint) return;
    const point = pointerToPoint(event) ?? dragPoint;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Safe when pointer capture is unavailable.
    }
    if (!point || interactionDistance(anchorPoint, point) < 7) {
      setDragPoint(null);
      return;
    }
    commitTwoPointDrawing(anchorPoint, point);
  }

  function onChartWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const direction = (event.deltaX || event.deltaY) > 0 ? 1 : -1;
      const step = Math.max(1, Math.round(visibleCount * 0.08));
      setPanOffset((value) => Math.max(0, Math.min(maxPanOffset, value + direction * step)));
      return;
    }
    const step = Math.max(4, Math.round(visibleCount * 0.12));
    if (event.deltaY < 0) {
      setVisibleCount((value) => Math.max(12, value - step));
    } else {
      setVisibleCount((value) => Math.min(Math.max(12, allChartData.length), value + step));
    }
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
    const x1 = xTime(first.x);
    const y1 = y(first.price);
    const x2 = second ? xTime(second.x) : x1;
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
      const bars = Math.max(0, Math.round(Math.abs(second!.x - first.x) / intervalMs));
      const duration = humanDuration(Math.abs(second!.x - first.x));
      return (
        <g key={drawing.id} className="text-primary" pointerEvents="none">
          <line x1={x1} x2={x2} y1={y1} y2={y2} stroke="currentColor" strokeDasharray="4 3" />
          <rect x={(x1 + x2) / 2 - 76} y={(y1 + y2) / 2 - 28} width="152" height="22" rx="4" className="fill-background stroke-border" />
          <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 13} textAnchor="middle" fill="currentColor" fontSize="10">Δ {formatPrice(delta)} · {pct.toFixed(2)}% · {bars} bars · {duration}</text>
        </g>
      );
    }
    if (drawing.type === "text") {
      return <text key={drawing.id} x={x1} y={y1} fill="currentColor" fontSize="12" className="text-caution">{drawing.text}</text>;
    }
    return null;
  }

  function renderDrawingInteraction(drawing: Drawing) {
    const first = drawing.points[0];
    const second = drawing.points[1];
    if (!first) return null;
    const x1 = xTime(first.x);
    const y1 = y(first.price);
    const x2 = second ? xTime(second.x) : x1;
    const y2 = second ? y(second.price) : y1;
    const selected = selectedDrawingId === drawing.id;
    const hitProps = {
      onPointerDown: (event: React.PointerEvent<SVGElement>) =>
        startDrawingEdit(event, drawing, null),
    };

    let body: React.ReactNode = null;
    if (drawing.type === "hline") {
      body = <line x1={pad.left} x2={width - pad.right} y1={y1} y2={y1} stroke="transparent" strokeWidth="14" {...hitProps} />;
    } else if (drawing.type === "vline") {
      body = <line x1={x1} x2={x1} y1={pad.top} y2={height - pad.bottom} stroke="transparent" strokeWidth="14" {...hitProps} />;
    } else if (drawing.type === "trend" || drawing.type === "measure") {
      body = <line x1={x1} x2={x2} y1={y1} y2={y2} stroke="transparent" strokeWidth="16" {...hitProps} />;
    } else if (drawing.type === "rectangle" || drawing.type === "fib") {
      body = (
        <rect
          x={Math.min(x1, x2) - 6}
          y={Math.min(y1, y2) - 6}
          width={Math.max(12, Math.abs(x2 - x1) + 12)}
          height={Math.max(12, Math.abs(y2 - y1) + 12)}
          fill="transparent"
          stroke="transparent"
          {...hitProps}
        />
      );
    } else if (drawing.type === "text") {
      body = <rect x={x1 - 6} y={y1 - 18} width="120" height="28" fill="transparent" {...hitProps} />;
    }

    return (
      <g key={`interaction-${drawing.id}`} className={drawingsLocked ? "cursor-not-allowed" : "cursor-move"}>
        {body}
        {selected && !drawingsLocked
          ? drawing.points.map((point, index) => (
              <circle
                key={`${drawing.id}-handle-${index}`}
                cx={xTime(point.x)}
                cy={y(point.price)}
                r="6"
                className="fill-background stroke-primary"
                strokeWidth="2"
                onPointerDown={(event) => startDrawingEdit(event, drawing, index)}
              />
            ))
          : null}
      </g>
    );
  }

  const hoverIndex = hoverPoint && chartData.length > 0
    ? Math.max(
        0,
        Math.min(chartData.length - 1, Math.round((hoverPoint.x - firstVisibleTime) / intervalMs)),
      )
    : 0;
  const hoverCandle = hoverPoint ? chartData[hoverIndex] : null;
  const activeToolLabel = TOOL_META.find((item) => item.id === tool)?.label ?? "Cursor";
  const toolInstruction = tool === "cursor"
    ? selectedDrawingId
      ? "Drawing selected · drag it to move · drag handles to resize · Delete removes"
      : "Drag empty chart to pan · mouse wheel zooms · click a drawing to edit"
    : tool === "crosshair"
      ? "Move across the chart to inspect price and candle time"
      : tool === "hline" || tool === "vline" || tool === "text"
        ? "Click once on the chart to place it"
        : anchorPoint
          ? "Drag and release, or click a second point to finish · Esc cancels"
          : "Click-drag across the chart, or click once then click a second point";
  const transportAgeMs = liveReceivedAtMs == null ? null : Math.max(0, Date.now() - liveReceivedAtMs);
  const marketAgeMs = liveEpoch == null ? null : Math.max(0, Date.now() - liveEpoch * 1_000);
  const effectiveTickAgeMs = marketAgeMs ?? transportAgeMs;
  const tickFresh = Boolean(
    liveConnected &&
    transportAgeMs != null && transportAgeMs < 6_000 &&
    effectiveTickAgeMs != null && effectiveTickAgeMs < 6_000
  );
  const tickAgeLabel = effectiveTickAgeMs == null
    ? "—"
    : effectiveTickAgeMs < 1_000
      ? `${Math.round(effectiveTickAgeMs)}ms`
      : `${(effectiveTickAgeMs / 1_000).toFixed(1)}s`;

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
            <span className={cn("inline-flex items-center gap-1 text-[11px]", tickFresh ? "text-primary" : "text-caution")}>
              <span className={cn("size-2 rounded-full", tickFresh ? "animate-pulse bg-primary" : "bg-caution")} />
              {tickFresh ? `LIVE · ${tickAgeLabel}` : liveConnected ? `STALE · ${tickAgeLabel}` : "RECONNECTING"}
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
        <button type="button" onClick={() => setPanOffset((value) => Math.min(maxPanOffset, value + Math.max(5, Math.round(visibleCount * 0.2))))} disabled={panOffset >= maxPanOffset} title="Pan to older candles" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"><ChevronLeft className="size-3.5" /></button>
        <button type="button" onClick={() => setPanOffset((value) => Math.max(0, value - Math.max(5, Math.round(visibleCount * 0.2))))} disabled={panOffset === 0} title="Pan toward live candles" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"><ChevronRight className="size-3.5" /></button>
        <button type="button" onClick={() => setVisibleCount((value) => Math.max(12, value - Math.max(4, Math.round(value * 0.15))))} title="Zoom in" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ZoomIn className="size-3.5" /></button>
        <button type="button" onClick={() => setVisibleCount((value) => Math.min(Math.max(12, allChartData.length), value + Math.max(4, Math.round(value * 0.15))))} title="Zoom out" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ZoomOut className="size-3.5" /></button>
        <button type="button" onClick={() => { setVisibleCount(Math.max(12, allChartData.length)); setPanOffset(0); }} title="Fit all loaded history" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Expand className="size-3.5" /></button>
        <button type="button" onClick={() => setPanOffset(0)} className={cn("rounded border px-2 py-1 text-[10px] font-semibold", panOffset === 0 ? "border-primary/40 text-primary" : "border-caution/50 text-caution")} title="Return to latest market candles">{panOffset === 0 ? "LIVE VIEW" : `BACK ${panOffset}`}</button>
        <span className="text-[10px] text-muted-foreground">{chartData.length}/{allChartData.length} candles</span>
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
              <button key={item.id} type="button" title={item.label} aria-label={item.label} onClick={() => { setTool(item.id); cancelInteraction(); }} className={cn("rounded p-2 transition-colors", tool === item.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="size-4" />
              </button>
            );
          })}
          <div className="my-1 h-px w-6 bg-border" />
          <button type="button" title={drawingsVisible ? "Hide drawings" : "Show drawings"} onClick={() => setDrawingsVisible((value) => !value)} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            {drawingsVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
          <button type="button" title="Undo last drawing (Ctrl/Cmd+Z)" disabled={drawings.length === 0} onClick={() => setDrawings((rows) => rows.slice(0, -1))} className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30">
            <Undo2 className="size-4" />
          </button>
          <button type="button" title={drawingsLocked ? "Unlock drawings" : "Lock drawings"} onClick={() => { setDrawingsLocked((value) => !value); cancelInteraction(); }} className={cn("rounded p-2 hover:bg-muted", drawingsLocked ? "text-primary" : "text-muted-foreground")}>
            {drawingsLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          </button>
          <button type="button" title="Clear drawings" onClick={() => { if (window.confirm("Clear all drawings for this market and timeframe?")) setDrawings([]); }} className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="relative min-w-0">
          <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[420px] rounded border border-border bg-background/90 px-2.5 py-1.5 text-[10px] shadow">
            <strong className="text-primary">{activeToolLabel}</strong><span className="text-muted-foreground"> · {toolInstruction}</span>
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className={cn(
              "block w-full select-none touch-none",
              tool !== "cursor" && "cursor-crosshair",
              tool === "cursor" && !panning && !editingDrawing && "cursor-grab",
              (panning || editingDrawing) && "cursor-grabbing",
              fullscreen ? "h-[calc(100vh-160px)] min-h-[620px]" : "h-[58vh] min-h-[480px]",
            )}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${symbol} ${mode} chart`}
            onPointerDown={onChartPointerDown}
            onPointerMove={onChartPointerMove}
            onPointerUp={onChartPointerUp}
            onWheel={onChartWheel}
            onPointerCancel={cancelInteraction}
            onPointerLeave={() => { if (!dragging && !panning && !editingDrawing) setHoverPoint(null); }}
            onContextMenu={(event) => { event.preventDefault(); cancelInteraction(); }}
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

            {panOffset === 0 ? (
              <>
                {renderLevel(entryPrice, "Entry")}
                {renderLevel(stopLoss, "SL")}
                {renderLevel(takeProfit1, "TP")}
                {renderLevel(currentPrice, "Live")}
              </>
            ) : null}

            {drawingsVisible ? drawings.map(renderDrawing) : null}
            {drawingsVisible && tool === "cursor" ? drawings.map(renderDrawingInteraction) : null}

            {drawingsVisible && anchorPoint && (dragPoint ?? hoverPoint) && (tool === "trend" || tool === "rectangle" || tool === "fib" || tool === "measure") ? (
              <g opacity="0.65" pointerEvents="none">
                {renderDrawing({ id: "__preview__", type: tool, points: [anchorPoint, (dragPoint ?? hoverPoint)!] })}
              </g>
            ) : null}

            {hoverPoint && tool === "crosshair" ? (
              <g className="text-muted-foreground/90" pointerEvents="none">
                <line x1={xTime(hoverPoint.x)} x2={xTime(hoverPoint.x)} y1={pad.top} y2={height - pad.bottom} stroke="currentColor" strokeDasharray="3 3" />
                <line x1={pad.left} x2={width - pad.right} y1={y(hoverPoint.price)} y2={y(hoverPoint.price)} stroke="currentColor" strokeDasharray="3 3" />
                <rect x={width - pad.right - 100} y={y(hoverPoint.price) - 12} width="96" height="20" rx="3" className="fill-background stroke-border" />
                <text x={width - pad.right - 8} y={y(hoverPoint.price) + 2} textAnchor="end" fill="currentColor" fontSize="10">{formatPrice(hoverPoint.price)}</text>
                {hoverCandle ? (
                  <>
                    <rect x={Math.max(pad.left, xTime(hoverPoint.x) - 48)} y={height - pad.bottom + 4} width="96" height="20" rx="3" className="fill-background stroke-border" />
                    <text x={xTime(hoverPoint.x)} y={height - pad.bottom + 18} textAnchor="middle" fill="currentColor" fontSize="10">{hoverCandle.label}</text>
                  </>
                ) : null}
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
