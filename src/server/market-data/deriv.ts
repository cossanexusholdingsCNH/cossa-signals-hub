// Cossa Signals — Deriv public market-data adapter
// Read-only market data only. No trading/account credentials are used here.
// The public WebSocket endpoint does not require authentication.

export const DERIV_PUBLIC_WS_URL =
  process.env.DERIV_PUBLIC_WS_URL?.trim() || "wss://api.derivws.com/trading/v1/options/ws/public";

export type DerivActiveSymbol = {
  underlying_symbol?: string;
  underlying_symbol_name?: string;
  underlying_symbol_type?: string;
  market?: string;
  subgroup?: string;
  submarket?: string;
  pip_size?: number;
  exchange_is_open?: number;
  is_trading_suspended?: number;
  symbol?: string;
  display_name?: string;
  symbol_type?: string;
  pip?: number;
};

export type DerivTick = {
  symbol: string;
  epoch: number;
  quote: number;
  bid?: number;
  ask?: number;
  pip_size?: number;
  id?: string;
};

export type DerivCandle = {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type DerivEnvelope = {
  msg_type?: string;
  req_id?: number;
  error?: { code?: string; message?: string };
  active_symbols?: DerivActiveSymbol[];
  tick?: DerivTick;
  candles?: DerivCandle[];
  history?: { prices?: number[]; times?: number[] };
};

type PendingRequest<T = unknown> = {
  socket: WebSocket;
  select: (message: DerivEnvelope) => T | undefined;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class DerivMarketDataError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DerivMarketDataError";
    this.code = code;
  }
}

const DERIV_TRANSIENT_ERROR_CODES = new Set(["WS_CONNECTION_FAILED", "REQUEST_TIMEOUT"]);
const DERIV_MAX_ATTEMPTS = 3;
const DERIV_RETRY_BASE_DELAY_MS = 250;

let sharedSocket: WebSocket | null = null;
let connectingSocket: Promise<WebSocket> | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function finiteNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new DerivMarketDataError(`Deriv returned invalid ${label}`);
  return parsed;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isTransientDerivError(error: unknown): error is DerivMarketDataError {
  return (
    error instanceof DerivMarketDataError &&
    error.code !== undefined &&
    DERIV_TRANSIENT_ERROR_CODES.has(error.code)
  );
}

function rejectPendingForSocket(socket: WebSocket, error: DerivMarketDataError) {
  for (const [requestId, pending] of pendingRequests) {
    if (pending.socket !== socket) continue;
    clearTimeout(pending.timer);
    pendingRequests.delete(requestId);
    pending.reject(error);
  }
}

function detachSocket(socket: WebSocket) {
  if (sharedSocket === socket) sharedSocket = null;
}

function failSocket(socket: WebSocket, message: string) {
  detachSocket(socket);
  rejectPendingForSocket(socket, new DerivMarketDataError(message, "WS_CONNECTION_FAILED"));
}

function installSocketHandlers(socket: WebSocket) {
  socket.onmessage = (event) => {
    let message: DerivEnvelope;
    try {
      message = JSON.parse(String(event.data)) as DerivEnvelope;
    } catch {
      return;
    }

    if (!Number.isInteger(message.req_id)) return;
    const requestId = message.req_id as number;
    const pending = pendingRequests.get(requestId);
    if (!pending || pending.socket !== socket) return;

    if (message.error) {
      clearTimeout(pending.timer);
      pendingRequests.delete(requestId);
      pending.reject(
        new DerivMarketDataError(
          message.error.message || "Deriv market-data request failed",
          message.error.code,
        ),
      );
      return;
    }

    try {
      const selected = pending.select(message);
      if (selected === undefined) return;
      clearTimeout(pending.timer);
      pendingRequests.delete(requestId);
      pending.resolve(selected);
    } catch (error) {
      clearTimeout(pending.timer);
      pendingRequests.delete(requestId);
      pending.reject(error);
    }
  };

  socket.onerror = () => failSocket(socket, "Deriv WebSocket connection failed");
  socket.onclose = () => failSocket(socket, "Deriv WebSocket connection closed");
}

async function getSharedSocket(): Promise<WebSocket> {
  if (sharedSocket?.readyState === WebSocket.OPEN) return sharedSocket;
  if (connectingSocket) return connectingSocket;

  connectingSocket = new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(DERIV_PUBLIC_WS_URL);
    let settled = false;
    const finishReject = (error: DerivMarketDataError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const connectionTimer = setTimeout(() => {
      try {
        socket.close();
      } catch {
        // Cleanup only.
      }
      finishReject(
        new DerivMarketDataError("Deriv WebSocket connection timed out", "REQUEST_TIMEOUT"),
      );
    }, 10_000);

    socket.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(connectionTimer);
      sharedSocket = socket;
      installSocketHandlers(socket);
      resolve(socket);
    };

    socket.onerror = () => {
      clearTimeout(connectionTimer);
      finishReject(
        new DerivMarketDataError("Deriv WebSocket connection failed", "WS_CONNECTION_FAILED"),
      );
    };

    socket.onclose = () => {
      clearTimeout(connectionTimer);
      finishReject(
        new DerivMarketDataError("Deriv WebSocket connection closed", "WS_CONNECTION_FAILED"),
      );
    };
  }).finally(() => {
    connectingSocket = null;
  });

  return connectingSocket;
}

async function requestAttempt<T>(
  payload: Record<string, unknown>,
  select: (message: DerivEnvelope) => T | undefined,
  timeoutMs: number,
): Promise<T> {
  const socket = await getSharedSocket();
  const requestId = nextRequestId++;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new DerivMarketDataError("Deriv market-data request timed out", "REQUEST_TIMEOUT"));
    }, timeoutMs);

    pendingRequests.set(requestId, { socket, select, resolve, reject, timer } as PendingRequest);

    try {
      socket.send(JSON.stringify({ ...payload, req_id: requestId }));
    } catch (error) {
      clearTimeout(timer);
      pendingRequests.delete(requestId);
      detachSocket(socket);
      reject(
        error instanceof Error
          ? new DerivMarketDataError(error.message, "WS_CONNECTION_FAILED")
          : new DerivMarketDataError("Deriv WebSocket send failed", "WS_CONNECTION_FAILED"),
      );
    }
  });
}

async function requestOnce<T>(
  payload: Record<string, unknown>,
  select: (message: DerivEnvelope) => T | undefined,
  timeoutMs = 10_000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DERIV_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestAttempt(payload, select, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isTransientDerivError(error) || attempt === DERIV_MAX_ATTEMPTS) throw error;
      const exponentialDelay = DERIV_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * DERIV_RETRY_BASE_DELAY_MS);
      await sleep(exponentialDelay + jitter);
    }
  }

  throw lastError;
}

export async function fetchDerivActiveSymbols(): Promise<DerivActiveSymbol[]> {
  return requestOnce({ active_symbols: "brief" }, (message) =>
    message.msg_type === "active_symbols" && Array.isArray(message.active_symbols)
      ? message.active_symbols
      : undefined,
  );
}

export async function fetchDerivTick(symbol: string): Promise<DerivTick> {
  if (!symbol.trim()) throw new DerivMarketDataError("Deriv symbol is required");
  return requestOnce({ ticks: symbol.trim() }, (message) => {
    if (message.msg_type !== "tick" || !message.tick) return undefined;
    return {
      ...message.tick,
      symbol: String(message.tick.symbol || symbol),
      epoch: finiteNumber(message.tick.epoch, "tick epoch"),
      quote: finiteNumber(message.tick.quote, "tick quote"),
      bid: message.tick.bid === undefined ? undefined : finiteNumber(message.tick.bid, "tick bid"),
      ask: message.tick.ask === undefined ? undefined : finiteNumber(message.tick.ask, "tick ask"),
    };
  });
}

export async function fetchDerivCandles(
  symbol: string,
  granularitySeconds: 60 | 300 | 900 | 1800 | 3600 | 14400 | 86400,
  count = 500,
): Promise<DerivCandle[]> {
  if (!symbol.trim()) throw new DerivMarketDataError("Deriv symbol is required");
  const safeCount = Math.max(1, Math.min(Math.trunc(count), 5_000));
  return requestOnce(
    {
      ticks_history: symbol.trim(),
      end: "latest",
      count: safeCount,
      style: "candles",
      granularity: granularitySeconds,
    },
    (message) => {
      if (!Array.isArray(message.candles)) return undefined;
      return message.candles.map((candle) => ({
        epoch: finiteNumber(candle.epoch, "candle epoch"),
        open: finiteNumber(candle.open, "candle open"),
        high: finiteNumber(candle.high, "candle high"),
        low: finiteNumber(candle.low, "candle low"),
        close: finiteNumber(candle.close, "candle close"),
      }));
    },
    15_000,
  );
}

export function normalizeDerivSymbol(symbol: DerivActiveSymbol) {
  const providerSymbol = symbol.underlying_symbol || symbol.symbol;
  if (!providerSymbol) return null;
  return {
    providerSymbol,
    displayName: symbol.underlying_symbol_name || symbol.display_name || providerSymbol,
    symbolType: symbol.underlying_symbol_type || symbol.symbol_type || "unknown",
    market: symbol.market || "unknown",
    subgroup: symbol.subgroup || null,
    submarket: symbol.submarket || null,
    pipSize: symbol.pip_size ?? symbol.pip ?? null,
    exchangeOpen: symbol.exchange_is_open !== 0,
    suspended: symbol.is_trading_suspended === 1,
  };
}
