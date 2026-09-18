import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { fetchDerivActiveSymbols, normalizeDerivSymbol, type DerivActiveSymbol } from "./deriv";

type NormalizedDerivSymbol = NonNullable<ReturnType<typeof normalizeDerivSymbol>>;

export type DerivSyntheticCandidate = NormalizedDerivSymbol & {
  cossaSymbol: string;
  category: string;
  timeframeDefault: "1m" | "5m";
  riskRating: "moderate" | "high" | "extreme";
};

export type DerivRegistryImportInput = {
  providerSymbols?: string[];
};

function canonicalSymbol(providerSymbol: string) {
  return `DERIV_${providerSymbol.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

function classifySynthetic(symbol: NormalizedDerivSymbol): Omit<DerivSyntheticCandidate, keyof NormalizedDerivSymbol> | null {
  const market = symbol.market.toLowerCase();
  if (market !== "synthetic_index") return null;

  const name = symbol.displayName.toLowerCase();
  const provider = symbol.providerSymbol.toLowerCase();
  let category = "synthetic_other";
  let timeframeDefault: "1m" | "5m" = "5m";
  let riskRating: "moderate" | "high" | "extreme" = "high";

  if (name.includes("boom") || provider.includes("boom")) {
    category = "boom";
    riskRating = "extreme";
  } else if (name.includes("crash") || provider.includes("crash")) {
    category = "crash";
    riskRating = "extreme";
  } else if (name.includes("step") || provider.includes("stp")) {
    category = "step";
    riskRating = "moderate";
  } else if (name.includes("volatility") || provider.startsWith("r_") || provider.includes("hz")) {
    category = name.includes("1s") || provider.includes("hz") ? "volatility_1s" : "volatility";
    timeframeDefault = category === "volatility_1s" ? "1m" : "5m";
    riskRating = category === "volatility_1s" ? "extreme" : "high";
  } else if (name.includes("bull") || name.includes("bear")) {
    category = "bull_bear";
  } else if (name.includes("range break")) {
    category = "range_break";
  } else if (name.includes("daily reset")) {
    category = "daily_reset";
  }

  return { cossaSymbol: canonicalSymbol(symbol.providerSymbol), category, timeframeDefault, riskRating };
}

export function discoverDerivSyntheticCandidates(activeSymbols: DerivActiveSymbol[]) {
  const candidates: DerivSyntheticCandidate[] = [];
  const seen = new Set<string>();

  for (const raw of activeSymbols) {
    const normalized = normalizeDerivSymbol(raw);
    if (!normalized || normalized.suspended) continue;
    const classification = classifySynthetic(normalized);
    if (!classification || seen.has(normalized.providerSymbol)) continue;
    seen.add(normalized.providerSymbol);
    candidates.push({ ...normalized, ...classification });
  }

  return candidates.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function resolveDerivProvider() {
  const provider = await supabaseAdmin
    .from("market_data_providers")
    .select("id,enabled")
    .eq("slug", "deriv")
    .single();
  if (provider.error || !provider.data) throw new Error(`Deriv provider is not configured: ${provider.error?.message ?? "missing row"}`);
  if (!provider.data.enabled) throw new Error("Deriv provider is disabled");
  return provider.data;
}

async function loadExistingRegistry(providerId: string) {
  const mappings = await supabaseAdmin
    .from("instrument_provider_mappings")
    .select("id,instrument_id,provider_symbol,enabled,is_primary")
    .eq("provider_id", providerId);
  if (mappings.error) throw new Error(`Unable to load Deriv mappings: ${mappings.error.message}`);

  const instrumentIds = [...new Set((mappings.data ?? []).map((row) => row.instrument_id))];
  const instruments = instrumentIds.length
    ? await supabaseAdmin.from("instruments").select("id,symbol,display_name").in("id", instrumentIds)
    : { data: [], error: null };
  if (instruments.error) throw new Error(`Unable to load existing Deriv instruments: ${instruments.error.message}`);

  return {
    mappings: mappings.data ?? [],
    instrumentById: new Map((instruments.data ?? []).map((row) => [row.id, row])),
  };
}

export async function reconcileDerivSyntheticRegistry() {
  const provider = await resolveDerivProvider();
  const activeSymbols = await fetchDerivActiveSymbols();
  const candidates = discoverDerivSyntheticCandidates(activeSymbols);
  const registry = await loadExistingRegistry(provider.id);
  const existingByProviderSymbol = new Map(registry.mappings.map((row) => [row.provider_symbol, row]));
  const discovered = [] as Array<Record<string, unknown>>;
  const alreadyRegistered = [] as Array<Record<string, unknown>>;

  for (const candidate of candidates) {
    const mapping = existingByProviderSymbol.get(candidate.providerSymbol);
    if (mapping) {
      const instrument = registry.instrumentById.get(mapping.instrument_id);
      alreadyRegistered.push({
        providerSymbol: candidate.providerSymbol,
        cossaSymbol: instrument?.symbol ?? candidate.cossaSymbol,
        displayName: instrument?.display_name ?? candidate.displayName,
        enabled: mapping.enabled,
        primary: mapping.is_primary,
      });
      continue;
    }

    discovered.push({
      providerSymbol: candidate.providerSymbol,
      cossaSymbol: candidate.cossaSymbol,
      displayName: candidate.displayName,
      category: candidate.category,
      timeframeDefault: candidate.timeframeDefault,
      riskRating: candidate.riskRating,
      market: candidate.market,
      subgroup: candidate.subgroup,
      submarket: candidate.submarket,
      pipSize: candidate.pipSize,
      exchangeOpen: candidate.exchangeOpen,
      proposedEnabled: false,
    });
  }

  return {
    ok: true as const,
    provider: "deriv",
    activeSymbolCount: activeSymbols.length,
    syntheticCandidateCount: candidates.length,
    alreadyRegisteredCount: alreadyRegistered.length,
    discoveredCount: discovered.length,
    alreadyRegistered,
    discovered,
  };
}

export async function importDiscoveredDerivSyntheticRegistry(input: DerivRegistryImportInput = {}) {
  const provider = await resolveDerivProvider();
  const candidates = discoverDerivSyntheticCandidates(await fetchDerivActiveSymbols());
  const requested = new Set((input.providerSymbols ?? []).map((value) => value.trim()).filter(Boolean));
  const selected = requested.size ? candidates.filter((candidate) => requested.has(candidate.providerSymbol)) : candidates;
  const known = new Set(candidates.map((candidate) => candidate.providerSymbol));
  const unknownRequested = [...requested].filter((providerSymbol) => !known.has(providerSymbol));
  if (unknownRequested.length) throw new Error(`Unknown or inactive Deriv symbols requested: ${unknownRequested.join(", ")}`);

  const registry = await loadExistingRegistry(provider.id);
  const existingByProviderSymbol = new Map(registry.mappings.map((row) => [row.provider_symbol, row]));
  const imported: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];

  for (const candidate of selected) {
    const existing = existingByProviderSymbol.get(candidate.providerSymbol);
    if (existing) {
      skipped.push({ providerSymbol: candidate.providerSymbol, reason: "already_registered" });
      continue;
    }

    const existingInstrument = await supabaseAdmin
      .from("instruments")
      .select("id,symbol")
      .eq("symbol", candidate.cossaSymbol)
      .maybeSingle();
    if (existingInstrument.error) throw new Error(`Unable to check ${candidate.cossaSymbol}: ${existingInstrument.error.message}`);

    let instrumentId = existingInstrument.data?.id;
    if (!instrumentId) {
      const instrument = await supabaseAdmin
        .from("instruments")
        .insert({
          symbol: candidate.cossaSymbol,
          display_name: candidate.displayName,
          asset_class: "synthetic_index",
          category: candidate.category,
          provider: "deriv",
          timeframe_default: candidate.timeframeDefault,
          market_status: candidate.exchangeOpen ? "open" : "unknown",
          enabled: false,
          validation_status: "experimental",
          minimum_sample_required: 30,
          description: `${candidate.displayName} discovered from Deriv active symbols. Pending Cossa validation.`,
          market_characteristics: `Deriv synthetic index; provider symbol ${candidate.providerSymbol}`,
          risk_rating: candidate.riskRating,
          data_source: "deriv",
          is_demo: false,
        })
        .select("id")
        .single();
      if (instrument.error || !instrument.data?.id) throw new Error(`Unable to import ${candidate.providerSymbol}: ${instrument.error?.message ?? "missing instrument id"}`);
      instrumentId = instrument.data.id;
    }

    const mapping = await supabaseAdmin.from("instrument_provider_mappings").insert({
      instrument_id: instrumentId,
      provider_id: provider.id,
      provider_symbol: candidate.providerSymbol,
      enabled: false,
      is_primary: false,
      metadata: {
        registry: "deriv-active-symbols-v1",
        discovered_at: new Date().toISOString(),
        market: candidate.market,
        subgroup: candidate.subgroup,
        submarket: candidate.submarket,
        pip_size: candidate.pipSize,
        validation_required: true,
        execution_eligible: false,
      },
    });
    if (mapping.error) {
      if (!existingInstrument.data?.id) await supabaseAdmin.from("instruments").delete().eq("id", instrumentId);
      throw new Error(`Unable to map ${candidate.providerSymbol}: ${mapping.error.message}`);
    }

    imported.push({
      providerSymbol: candidate.providerSymbol,
      cossaSymbol: candidate.cossaSymbol,
      displayName: candidate.displayName,
      instrumentId,
      enabled: false,
      validationStatus: "experimental",
      executionEligible: false,
    });
  }

  return {
    ok: true as const,
    provider: "deriv",
    selectedCount: selected.length,
    importedCount: imported.length,
    skippedCount: skipped.length,
    imported,
    skipped,
  };
}
