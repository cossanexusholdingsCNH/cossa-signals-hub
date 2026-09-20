import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { fetchDerivTick } from "./deriv";

type MappingRow = {
  provider_symbol: string;
  instrument_id: string;
};

const DEFAULT_CONCURRENCY = 8;
const MAX_CONCURRENCY = 12;
const MIN_HEALTHY_SUCCESS_RATIO = 0.9;

function concurrencyLimit() {
  const configured = Number.parseInt(process.env.DERIV_HEARTBEAT_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(configured) || configured < 1) return DEFAULT_CONCURRENCY;
  return Math.min(configured, MAX_CONCURRENCY);
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
  const tick = await fetchDerivTick(mapping.provider_symbol);
  const tickAt = new Date(tick.epoch * 1000);
  if (!Number.isFinite(tickAt.getTime())) throw new Error("Deriv returned an invalid tick timestamp");
  if (Math.abs(Date.now() - tickAt.getTime()) > 120_000) throw new Error("Deriv heartbeat tick is stale");

  const [tickWrite, instrumentWrite] = await Promise.all([
    supabaseAdmin.from("market_ticks").upsert(
      {
        instrument_id: mapping.instrument_id,
        provider_id: providerId,
        provider_symbol: mapping.provider_symbol,
        tick_at: tickAt.toISOString(),
        price: tick.quote,
        bid: tick.bid ?? null,
        ask: tick.ask ?? null,
        epoch: tick.epoch,
        source_sequence: tick.id ?? null,
        is_demo: false,
        metadata: { runtime: "deriv-heartbeat-v1" },
      },
      { onConflict: "instrument_id,provider_id,tick_at,price", ignoreDuplicates: true },
    ),
    supabaseAdmin
      .from("instruments")
      .update({
        current_price: tick.quote,
        last_data_at: tickAt.toISOString(),
        data_source: "deriv",
        market_status: "open",
        is_demo: false,
      })
      .eq("id", mapping.instrument_id),
  ]);

  if (tickWrite.error) throw new Error(`Tick write failed: ${tickWrite.error.message}`);
  if (instrumentWrite.error) throw new Error(`Instrument heartbeat failed: ${instrumentWrite.error.message}`);

  return { symbol: mapping.provider_symbol, price: tick.quote, at: tickAt.toISOString() };
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
  const { data, error } = await supabaseAdmin
    .from("instrument_provider_mappings")
    .select("provider_symbol,instrument_id,instruments(enabled)")
    .eq("provider_id", provider.id)
    .eq("enabled", true)
    .order("provider_symbol");
  if (error) throw new Error(`Unable to load Deriv mappings: ${error.message}`);

  const mappings: MappingRow[] = (data ?? [])
    .filter((row) => {
      const instrument = Array.isArray(row.instruments) ? row.instruments[0] : row.instruments;
      return instrument?.enabled;
    })
    .map((row) => ({ provider_symbol: row.provider_symbol, instrument_id: row.instrument_id }));

  if (!mappings.length) throw new Error("No enabled Deriv instruments are configured");

  const results = await runPool(mappings, concurrencyLimit(), async (mapping) => {
    try {
      return await persistHeartbeat(provider.id, mapping);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Heartbeat failed";
      throw new Error(`${mapping.provider_symbol}: ${message}`);
    }
  });
  const failures = results.filter((result) => result instanceof Error);
  const succeeded = mappings.length - failures.length;
  const successRatio = succeeded / mappings.length;
  const healthy = successRatio >= MIN_HEALTHY_SUCCESS_RATIO;
  const latestSuccess = results
    .filter((result): result is { symbol: string; price: number; at: string } => !(result instanceof Error))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];

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
  } else {
    await markTotalFailure(provider.id);
  }

  return {
    ok: healthy,
    degraded: failures.length > 0,
    attempted: mappings.length,
    succeeded,
    failed: failures.length,
    successRatio: Number(successRatio.toFixed(4)),
    minimumHealthyRatio: MIN_HEALTHY_SUCCESS_RATIO,
    latestAt: latestSuccess?.at ?? null,
    errors: failures.slice(0, 10).map((error) => error.message),
  };
}
