import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { fetchDerivActiveSymbols, fetchDerivCandles, normalizeDerivSymbol } from "./deriv";

type MappingRow = {
  provider_symbol: string;
  instrument_id: string;
};

type HeartbeatSuccess = {
  symbol: string;
  price: number;
  at: string;
};

type HeartbeatClosed = {
  symbol: string;
  closed: true;
  reason: string;
};

const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 12;
const MIN_HEALTHY_SUCCESS_RATIO = 0.9;

function concurrencyLimit() {
  const configured = Number.parseInt(process.env.DERIV_HEARTBEAT_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(configured) || configured < 1) return DEFAULT_CONCURRENCY;
  return Math.min(configured, MAX_CONCURRENCY);
}

function isExpectedMarketClosure(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("market is presently closed") || normalized.includes("market is closed");
}

function isHeartbeatClosed(result: HeartbeatSuccess | HeartbeatClosed | Error): result is HeartbeatClosed {
  return !(result instanceof Error) && "closed" in result && result.closed === true;
}

function isHeartbeatSuccess(result: HeartbeatSuccess | HeartbeatClosed | Error): result is HeartbeatSuccess {
  return !(result instanceof Error) && !isHeartbeatClosed(result);
}

async function resolveProvider() {
  const { data, error } = await supabaseAdmin
    .from("market_data_providers")
    .select("id,enabled,circuit_open_until")
    .eq("slug", "deriv")
    .single();
  if (error || !data) throw new Error(`Deriv provider missing: ${error?.message ?? "unknown"}`);
  if (!data.enabled) throw new Error("Deriv provider is disabled");
  return data;
}

async function persistHeartbeat(providerId: string, mapping: MappingRow) {
  const candles = await fetchDerivCandles(mapping.provider_symbol, 60, 2);
  const latest = candles.at(-1);
  if (!latest) throw new Error("Deriv returned no one-minute candle snapshot");

  const snapshotAt = new Date(latest.epoch * 1000);
  if (!Number.isFinite(snapshotAt.getTime())) {
    throw new Error("Deriv returned an invalid heartbeat timestamp");
  }
  if (Math.abs(Date.now() - snapshotAt.getTime()) > 120_000) {
    throw new Error("Deriv heartbeat snapshot is stale");
  }

  const [tickWrite, instrumentWrite] = await Promise.all([
    supabaseAdmin.from("market_ticks").upsert(
      {
        instrument_id: mapping.instrument_id,
        provider_id: providerId,
        provider_symbol: mapping.provider_symbol,
        tick_at: snapshotAt.toISOString(),
        price: latest.close,
        bid: null,
        ask: null,
        epoch: latest.epoch,
        source_sequence: null,
        is_demo: false,
        metadata: { runtime: "deriv-heartbeat-v2", source: "one-minute-candle-snapshot" },
      },
      { onConflict: "instrument_id,provider_id,tick_at,price", ignoreDuplicates: true },
    ),
    supabaseAdmin
      .from("instruments")
      .update({
        current_price: latest.close,
        last_data_at: snapshotAt.toISOString(),
        data_source: "deriv",
        market_status: "open",
        is_demo: false,
      })
      .eq("id", mapping.instrument_id),
  ]);

  if (tickWrite.error) throw new Error(`Tick write failed: ${tickWrite.error.message}`);
  if (instrumentWrite.error) throw new Error(`Instrument heartbeat failed: ${instrumentWrite.error.message}`);

  return { symbol: mapping.provider_symbol, price: latest.close, at: snapshotAt.toISOString() };
}

async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: Array<R | Error> = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        results[index] = error instanceof Error ? error : new Error("Heartbeat failed");
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function markTotalFailure(providerId: string) {
  const current = await supabaseAdmin
    .from("market_data_providers")
    .select("consecutive_failures")
    .eq("id", providerId)
    .single();
  const failures = Math.max(0, current.data?.consecutive_failures ?? 0) + 1;
  const circuitOpenUntil = failures >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
  await supabaseAdmin
    .from("market_data_providers")
    .update({
      last_failure_at: new Date().toISOString(),
      consecutive_failures: failures,
      circuit_open_until: circuitOpenUntil,
    })
    .eq("id", providerId);
}

export async function runEnabledDerivHeartbeat() {
  const provider = await resolveProvider();
  const [{ data, error }, activeSymbols] = await Promise.all([
    supabaseAdmin
      .from("instrument_provider_mappings")
      .select("provider_symbol,instrument_id,instruments(enabled)")
      .eq("provider_id", provider.id)
      .eq("enabled", true)
      .order("provider_symbol"),
    fetchDerivActiveSymbols(),
  ]);
  if (error) throw new Error(`Unable to load Deriv mappings: ${error.message}`);

  const mappings: MappingRow[] = (data ?? [])
    .filter((row) => {
      const instrument = Array.isArray(row.instruments) ? row.instruments[0] : row.instruments;
      return instrument?.enabled;
    })
    .map((row) => ({ provider_symbol: row.provider_symbol, instrument_id: row.instrument_id }));

  if (!mappings.length) throw new Error("No enabled Deriv instruments are configured");

  const marketOpen = new Map<string, boolean>();
  for (const symbol of activeSymbols) {
    const normalized = normalizeDerivSymbol(symbol);
    if (!normalized) continue;
    marketOpen.set(normalized.providerSymbol, normalized.exchangeOpen && !normalized.suspended);
  }

  const results = await runPool<MappingRow, HeartbeatSuccess | HeartbeatClosed>(
    mappings,
    concurrencyLimit(),
    async (mapping) => {
      if (marketOpen.get(mapping.provider_symbol) === false) {
        return {
          symbol: mapping.provider_symbol,
          closed: true,
          reason: "Deriv active_symbols reports this market closed or suspended",
        };
      }

      try {
        return await persistHeartbeat(provider.id, mapping);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Heartbeat failed";
        if (isExpectedMarketClosure(message)) {
          return { symbol: mapping.provider_symbol, closed: true, reason: message };
        }
        throw new Error(`${mapping.provider_symbol}: ${message}`);
      }
    },
  );

  const failures = results.filter((result): result is Error => result instanceof Error);
  const closed = results.filter(isHeartbeatClosed);
  const successes = results.filter(isHeartbeatSuccess);
  const eligible = successes.length + failures.length;
  const succeeded = successes.length;
  const successRatio = eligible === 0 ? 1 : succeeded / eligible;
  const healthy = successRatio >= MIN_HEALTHY_SUCCESS_RATIO;
  const latestSuccess = successes.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];

  if (healthy && latestSuccess) {
    await supabaseAdmin
      .from("market_data_providers")
      .update({
        last_success_at: latestSuccess.at,
        consecutive_failures: 0,
        circuit_open_until: null,
      })
      .eq("id", provider.id);
  } else if (latestSuccess) {
    await supabaseAdmin
      .from("market_data_providers")
      .update({
        last_success_at: latestSuccess.at,
        last_failure_at: new Date().toISOString(),
      })
      .eq("id", provider.id);
  } else if (failures.length > 0) {
    await markTotalFailure(provider.id);
  }

  return {
    ok: healthy,
    degraded: failures.length > 0,
    attempted: mappings.length,
    eligible,
    succeeded,
    failed: failures.length,
    closed: closed.length,
    successRatio: Number(successRatio.toFixed(4)),
    minimumHealthyRatio: MIN_HEALTHY_SUCCESS_RATIO,
    latestAt: latestSuccess?.at ?? null,
    errors: failures.slice(0, 10).map((error) => error.message),
    closedMarkets: closed.slice(0, 10).map((result) => ({
      symbol: result.symbol,
      reason: result.reason,
    })),
  };
}
