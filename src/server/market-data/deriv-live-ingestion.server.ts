import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { fetchDerivTick } from "./deriv";
import { runAndPersistDerivSignal } from "../signals/persist-pipeline.server";
import type { SupportedTimeframe } from "../signals/deriv-signal-pipeline";

export type DerivLiveIngestionInput = {
  providerSymbol: string;
  timeframe?: SupportedTimeframe;
};

type RuntimeMapping = {
  instrumentId: string;
  providerId: string;
  providerSymbol: string;
};

type EnabledDerivMapping = {
  providerSymbol: string;
  timeframe: SupportedTimeframe;
};

const DEFAULT_DERIV_INGESTION_CONCURRENCY = 3;
const MAX_DERIV_INGESTION_CONCURRENCY = 6;

function derivIngestionConcurrency() {
  const configured = Number.parseInt(process.env.DERIV_INGESTION_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(configured) || configured < 1) {
    return DEFAULT_DERIV_INGESTION_CONCURRENCY;
  }
  return Math.min(configured, MAX_DERIV_INGESTION_CONCURRENCY);
}

async function resolveDerivProvider() {
  const provider = await supabaseAdmin
    .from("market_data_providers")
    .select("id,enabled,circuit_open_until")
    .eq("slug", "deriv")
    .single();

  if (provider.error || !provider.data) {
    throw new Error(
      `Deriv provider is not configured: ${provider.error?.message ?? "missing row"}`,
    );
  }
  if (!provider.data.enabled) throw new Error("Deriv provider is disabled");
  if (
    provider.data.circuit_open_until &&
    new Date(provider.data.circuit_open_until).getTime() > Date.now()
  ) {
    throw new Error("Deriv provider circuit breaker is open");
  }
  return provider.data;
}

async function resolveRuntimeMapping(providerSymbol: string): Promise<RuntimeMapping> {
  const provider = await resolveDerivProvider();
  const mapping = await supabaseAdmin
    .from("instrument_provider_mappings")
    .select("instrument_id,provider_symbol,enabled")
    .eq("provider_id", provider.id)
    .eq("provider_symbol", providerSymbol)
    .single();

  if (mapping.error || !mapping.data) {
    throw new Error(
      `Deriv instrument mapping is missing: ${mapping.error?.message ?? providerSymbol}`,
    );
  }
  if (!mapping.data.enabled) throw new Error(`Deriv mapping ${providerSymbol} is disabled`);

  return {
    instrumentId: mapping.data.instrument_id,
    providerId: provider.id,
    providerSymbol: mapping.data.provider_symbol,
  };
}

async function startRun(mapping: RuntimeMapping) {
  const { data, error } = await supabaseAdmin
    .from("market_data_ingestion_runs")
    .insert({
      provider_id: mapping.providerId,
      instrument_id: mapping.instrumentId,
      run_type: "candle_refresh",
      status: "running",
      metadata: { provider_symbol: mapping.providerSymbol, runtime: "deriv-live-v1" },
    })
    .select("id,started_at")
    .single();
  if (error || !data?.id) {
    throw new Error(`Unable to start ingestion run: ${error?.message ?? "missing id"}`);
  }
  return data;
}

async function markProviderSuccess(providerId: string, at: string) {
  const { error } = await supabaseAdmin
    .from("market_data_providers")
    .update({ last_success_at: at, consecutive_failures: 0, circuit_open_until: null })
    .eq("id", providerId);
  if (error) throw new Error(`Unable to update Deriv heartbeat: ${error.message}`);
}

async function markProviderFailure(providerId: string) {
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

async function persistTick(
  mapping: RuntimeMapping,
  tick: Awaited<ReturnType<typeof fetchDerivTick>>,
) {
  const tickAt = new Date(tick.epoch * 1000);
  if (!Number.isFinite(tickAt.getTime())) {
    throw new Error("Deriv returned an invalid tick timestamp");
  }
  if (Math.abs(Date.now() - tickAt.getTime()) > 120_000) {
    throw new Error("Deriv tick is stale");
  }

  const { error } = await supabaseAdmin.from("market_ticks").upsert(
    {
      instrument_id: mapping.instrumentId,
      provider_id: mapping.providerId,
      provider_symbol: mapping.providerSymbol,
      tick_at: tickAt.toISOString(),
      price: tick.quote,
      bid: tick.bid ?? null,
      ask: tick.ask ?? null,
      epoch: tick.epoch,
      source_sequence: tick.id ?? null,
      is_demo: false,
      metadata: { runtime: "deriv-live-v1" },
    },
    { onConflict: "instrument_id,provider_id,tick_at,price", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Unable to persist Deriv tick: ${error.message}`);

  const instrument = await supabaseAdmin
    .from("instruments")
    .update({
      current_price: tick.quote,
      last_data_at: tickAt.toISOString(),
      data_source: "deriv",
      market_status: "open",
      is_demo: false,
    })
    .eq("id", mapping.instrumentId);
  if (instrument.error) {
    throw new Error(`Unable to update live instrument state: ${instrument.error.message}`);
  }

  return tickAt;
}

export async function runDerivLiveIngestion(input: DerivLiveIngestionInput) {
  const providerSymbol = input.providerSymbol.trim();
  if (!providerSymbol) throw new Error("providerSymbol is required");
  const timeframe = input.timeframe ?? "5m";
  const mapping = await resolveRuntimeMapping(providerSymbol);
  const run = await startRun(mapping);
  const startedMs = Date.now();

  try {
    const tick = await fetchDerivTick(mapping.providerSymbol);
    const tickAt = await persistTick(mapping, tick);
    await markProviderSuccess(mapping.providerId, tickAt.toISOString());
    const signal = await runAndPersistDerivSignal({
      instrumentId: mapping.instrumentId,
      providerId: mapping.providerId,
      providerSymbol: mapping.providerSymbol,
      timeframe,
    });
    const finishedAt = new Date();
    const { error } = await supabaseAdmin
      .from("market_data_ingestion_runs")
      .update({
        status: "succeeded",
        finished_at: finishedAt.toISOString(),
        records_received: 1 + signal.evidence.candleCount,
        records_written: 1 + signal.evidence.candleCount,
        latency_ms: Math.max(0, finishedAt.getTime() - startedMs),
        metadata: {
          provider_symbol: mapping.providerSymbol,
          runtime: "deriv-live-v1",
          tick_at: tickAt.toISOString(),
          tick_price: tick.quote,
          timeframe,
          evidence_id: signal.evidenceId,
          engine_run_id: signal.engineRunId || null,
          duplicate: signal.duplicate,
          decision: signal.evidence.plan.direction,
        },
      })
      .eq("id", run.id);
    if (error) throw new Error(`Unable to finish ingestion audit: ${error.message}`);

    return {
      ok: true as const,
      provider: "deriv",
      providerSymbol: mapping.providerSymbol,
      instrumentId: mapping.instrumentId,
      tick: { price: tick.quote, at: tickAt.toISOString() },
      timeframe,
      decision: signal.evidence.plan.direction,
      confidence: signal.evidence.plan.confidence,
      duplicate: signal.duplicate,
      ingestionRunId: run.id,
    };
  } catch (error) {
    await markProviderFailure(mapping.providerId);
    const message = error instanceof Error ? error.message : "Unknown Deriv ingestion failure";
    await supabaseAdmin
      .from("market_data_ingestion_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        latency_ms: Math.max(0, Date.now() - startedMs),
        error_message: message.slice(0, 1000),
      })
      .eq("id", run.id);
    throw error;
  }
}

async function ingestEnabledMapping(mapping: EnabledDerivMapping) {
  try {
    return await runDerivLiveIngestion({
      providerSymbol: mapping.providerSymbol,
      timeframe: mapping.timeframe,
    });
  } catch (error) {
    return {
      ok: false as const,
      provider: "deriv",
      providerSymbol: mapping.providerSymbol,
      error: error instanceof Error ? error.message : "Unknown Deriv ingestion failure",
    };
  }
}

async function runWithBoundedConcurrency(mappings: EnabledDerivMapping[], concurrency: number) {
  const results: Awaited<ReturnType<typeof ingestEnabledMapping>>[] = new Array(mappings.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= mappings.length) return;
      results[index] = await ingestEnabledMapping(mappings[index]);
    }
  }

  const workerCount = Math.min(concurrency, mappings.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function runEnabledDerivIngestion() {
  const provider = await resolveDerivProvider();
  const { data: mappings, error } = await supabaseAdmin
    .from("instrument_provider_mappings")
    .select("provider_symbol,instrument_id,instruments(timeframe_default,enabled)")
    .eq("provider_id", provider.id)
    .eq("enabled", true)
    .order("provider_symbol");

  if (error) throw new Error(`Unable to load enabled Deriv mappings: ${error.message}`);
  if (!mappings?.length) {
    throw new Error("No enabled Deriv instrument mappings are configured");
  }

  const enabledMappings: EnabledDerivMapping[] = [];
  for (const mapping of mappings) {
    const instrument = Array.isArray(mapping.instruments)
      ? mapping.instruments[0]
      : mapping.instruments;
    if (!instrument?.enabled) continue;
    enabledMappings.push({
      providerSymbol: mapping.provider_symbol,
      timeframe: (instrument.timeframe_default || "5m") as SupportedTimeframe,
    });
  }

  if (!enabledMappings.length) {
    throw new Error("No enabled Deriv instruments are configured");
  }

  const concurrency = derivIngestionConcurrency();
  const results = await runWithBoundedConcurrency(enabledMappings, concurrency);
  const succeeded = results.filter((result) => result.ok).length;

  return {
    ok: succeeded > 0,
    provider: "deriv",
    attempted: results.length,
    succeeded,
    failed: results.length - succeeded,
    concurrency,
    results,
  };
}
