// Cossa Signals — Deriv public market-data adapter
// Read-only market data only. No trading/account credentials are used here.
// The public WebSocket endpoint does not require authentication.

export const DERIV_PUBLIC_WS_URL =
  process.env.DERIV_PUBLIC_WS_URL?.trim() ||
  "wss://api.derivws.com/trading/v1/options/ws/public";

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
  // Legacy compatibility while Deriv clients transition to the current schema.
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
  error?: { code?: string; message?: string };
  active_symbols?: DerivActiveSymbol[];
  tick?: DerivTick;
  candles?: DerivCandle[];
  history?: {
    prices?: number[];
    times?: number[];
  };
};

export class DerivMarketDataError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DerivMarketDataError";
    this.code = code;
  }
}

const DERIV_TRANSIENT_ERROR_CODES = new Set([
  "WS_CONNECTION_FAILED",
  "REQUEST_TIMEOUT",
]);
const DERIV_MAX_ATTEMPTS = 3;
const DERIV_RETRY_BASE_DELAY_MS = 250;

function finiteNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new DerivMarketDataError(`Deriv returned invalid ${label}`);
  }
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

async function requestAttempt<T>(
  payload: Record<string, unknown>,
  select: (message: DerivEnvelope) => T | undefined,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const socket = new WebSocket(DERIV_PUBLIC_WS_URL);
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // Socket cleanup must never mask the actual result.
      }
      fn();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new DerivMarketDataError(
            "Deriv market-data request timed out",
            "REQUEST_TIMEOUT",
          ),
        ),
      );
    }, timeoutMs);

    socket.onopen = () => {
      socket.send(JSON.stringify(payload));
    };

    socket.onerror = () => {
      finish(() =>
        reject(
          new DerivMarketDataError(
            "Deriv WebSocket connection failed",
            "WS_CONNECTION_FAILED",
          ),
        ),
      );
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as DerivEnvelope;
        if (message.error) {
          finish(() =>
            reject(
              new DerivMarketDataError(
                message.error?.message || "Deriv market-data request failed",
                message.error?.code,
              ),
            ),
          );
          return;
        }

        const selected = select(message);
        if (selected !== undefined) finish(() => resolve(selected));
      } catch (error) {
        finish(() =>
          reject(
            error instanceof Error
              ? error
              : new DerivMarketDataError("Unable to parse Deriv response"),
          ),
        );
      }
    };
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
      if (!isTransientDerivError(error) || attempt === DERIV_MAX_ATTEMPTS) {
        throw error;
      }

      const exponentialDelay = DERIV_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * DERIV_RETRY_BASE_DELAY_MS);
      await sleep(exponentialDelay + jitter);
    }
  }

  throw lastError;
}

export async function fetchDerivActiveSymbols(): Promise<DerivActiveSymbol[]> {
  return requestOnce({ active_symbols: "brief", req_id: 1 }, (message) =>
    message.msg_type === "active_symbols" && Array.isArray(message.active_symbols)
      ? message.active_symbols
      : undefined,
  );
}

export async function fetchDerivTick(symbol: string): Promise<DerivTick> {
  if (!symbol.trim()) {
    throw new DerivMarketDataError("Deriv symbol is required");
  }

  return requestOnce({ ticks: symbol.trim(), req_id: 1 }, (message) => {
    if (message.msg_type !== "tick" || !message.tick) return undefined;
    return {
      ...message.tick,
      symbol: String(message.tick.symbol || symbol),
      epoch: finiteNumber(message.tick.epoch, "tick epoch"),
      quote: finiteNumber(message.tick.quote, "tick quote"),
      bid:
        message.tick.bid === undefined
          ? undefined
          : finiteNumber(message.tick.bid, "tick bid"),
      ask:
        message.tick.ask === undefined
          ? undefined
          : finiteNumber(message.tick.ask, "tick ask"),
    };
  });
}

export async function fetchDerivCandles(
  symbol: string,
  granularitySeconds: 60 | 300 | 900 | 1800 | 3600 | 14400 | 86400,
  count = 500,
): Promise<DerivCandle[]> {
  if (!symbol.trim()) {
    throw new DerivMarketDataError("Deriv symbol is required");
  }
  const safeCount = Math.max(1, Math.min(Math.trunc(count), 5_000));

  return requestOnce(
    {
      ticks_history: symbol.trim(),
      end: "latest",
      count: safeCount,
      style: "candles",
      granularity: granularitySeconds,
      req_id: 1,
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
    displayName:
      symbol.underlying_symbol_name || symbol.display_name || providerSymbol,
    symbolType:
      symbol.underlying_symbol_type || symbol.symbol_type || "unknown",
    market: symbol.market || "unknown",
    subgroup: symbol.subgroup || null,
    submarket: symbol.submarket || null,
    pipSize: symbol.pip_size ?? symbol.pip ?? null,
    exchangeOpen: symbol.exchange_is_open !== 0,
    suspended: symbol.is_trading_suspended === 1,
  };
}
