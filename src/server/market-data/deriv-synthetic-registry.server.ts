import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { fetchDerivActiveSymbols, normalizeDerivSymbol, type DerivActiveSymbol } from "./deriv";

type NormalizedDerivSymbol = NonNullable<ReturnType<typeof normalizeDerivSymbol>>;

export type DerivSyntheticCandidate = NormalizedDerivSymbol & {
  cossaSymbol: string;
  category: string;
  timeframeDefault: "1m" | "5m";
  riskRating: "moderate" | "high" | "extreme";
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

export async function reconcileDerivSyntheticRegistry() {
  const provider = await supabaseAdmin
    .from("market_data_providers")
    .select("id,enabled")
    .eq("slug", "deriv")
    .single();
  if (provider.error || !provider.data) throw new Error(`Deriv provider is not configured: ${provider.error?.message ?? "missing row"}`);
  if (!provider.data.enabled) throw new Error("Deriv provider is disabled");

  const activeSymbols = await fetchDerivActiveSymbols();
  const candidates = discoverDerivSyntheticCandidates(activeSymbols);

  const existingMappings = await supabaseAdmin
    .from("instrument_provider_mappings")
    .select("id,instrument_id,provider_symbol,enabled,is_primary")
    .eq("provider_id", provider.data.id);
  if (existingMappings.error) throw new Error(`Unable to load Deriv mappings: ${existingMappings.error.message}`);

  const existingByProviderSymbol = new Map((existingMappings.data ?? []).map((row) => [row.provider_symbol, row]));
  const existingInstrumentIds = [...new Set((existingMappings.data ?? []).map((row) => row.instrument_id))];
  const existingInstruments = existingInstrumentIds.length
    ? await supabaseAdmin.from("instruments").select("id,symbol,display_name").in("id", existingInstrumentIds)
    : { data: [], error: null };
  if (existingInstruments.error) throw new Error(`Unable to load existing Deriv instruments: ${existingInstruments.error.message}`);

  const instrumentById = new Map((existingInstruments.data ?? []).map((row) => [row.id, row]));
  const discovered = [] as Array<Record<string, unknown>>;
  const alreadyRegistered = [] as Array<Record<string, unknown>>;

  for (const candidate of candidates) {
    const mapping = existingByProviderSymbol.get(candidate.providerSymbol);
    if (mapping) {
      const instrument = instrumentById.get(mapping.instrument_id);
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
      // Discovery is intentionally non-destructive: new symbols are not inserted or enabled here.
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
