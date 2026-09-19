import { createFileRoute } from "@tanstack/react-router";

import {
  rankOpportunities,
  validateScannerSettings,
  type ScannerEvidence,
  type ScannerSettings,
  type ScannerStructure,
} from "@/lib/opportunity-scanner";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

type ControlsRow = {
  scanner_min_signal_confidence: number;
  scanner_min_data_confidence: number;
  scanner_min_risk_reward: number;
  scanner_max_candidate_age_minutes: number;
  scanner_weight_signal: number;
  scanner_weight_data: number;
  scanner_weight_risk_reward: number;
  scanner_weight_structure: number;
  scanner_weight_regime: number;
};

type EvidenceRow = {
  id: string;
  instrument_id: string;
  provider_symbol: string;
  timeframe: string;
  direction: ScannerEvidence["direction"];
  regime: string;
  confidence_score: number;
  data_confidence_score: number | null;
  risk_reward_ratio: number | null;
  entry: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  generated_at: string;
  data_to: string;
  no_trade_reasons: string[] | null;
  reasons: string[] | null;
  instrument:
    | {
        id: string;
        symbol: string;
        display_name: string;
        asset_class: string;
        category: string;
      }
    | Array<{
        id: string;
        symbol: string;
        display_name: string;
        asset_class: string;
        category: string;
      }>
    | null;
};

type StructureRow = {
  instrument_id: string;
  timeframe: string;
  data_to: string;
  analysis: unknown;
};

type ScannerControlUpdateResult = { error: { message: string } | null };
type ScannerControlsWriter = {
  from(table: "platform_controls"): {
    update(values: Record<string, number>): {
      eq(column: "id", value: string): PromiseLike<ScannerControlUpdateResult>;
    };
  };
};

function settingsFromControls(row: ControlsRow): ScannerSettings {
  return {
    minSignalConfidence: Number(row.scanner_min_signal_confidence),
    minDataConfidence: Number(row.scanner_min_data_confidence),
    minRiskReward: Number(row.scanner_min_risk_reward),
    maxCandidateAgeMinutes: Number(row.scanner_max_candidate_age_minutes),
    weights: {
      signal: Number(row.scanner_weight_signal),
      data: Number(row.scanner_weight_data),
      riskReward: Number(row.scanner_weight_risk_reward),
      structure: Number(row.scanner_weight_structure),
      regime: Number(row.scanner_weight_regime),
    },
  };
}

function controlsPatch(settings: ScannerSettings) {
  return {
    scanner_min_signal_confidence: settings.minSignalConfidence,
    scanner_min_data_confidence: settings.minDataConfidence,
    scanner_min_risk_reward: settings.minRiskReward,
    scanner_max_candidate_age_minutes: settings.maxCandidateAgeMinutes,
    scanner_weight_signal: settings.weights.signal,
    scanner_weight_data: settings.weights.data,
    scanner_weight_risk_reward: settings.weights.riskReward,
    scanner_weight_structure: settings.weights.structure,
    scanner_weight_regime: settings.weights.regime,
  };
}

function structureFromAnalysis(value: unknown): ScannerStructure | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const trend = row.trend;
  const breakout = row.breakout;
  if (!["bullish", "bearish", "range", "transition"].includes(String(trend))) return null;
  if (!["bullish", "bearish", "none"].includes(String(breakout))) return null;
  return {
    trend: trend as ScannerStructure["trend"],
    breakout: breakout as ScannerStructure["breakout"],
    nearestSupport:
      typeof row.nearestSupport === "number"
        ? row.nearestSupport
        : typeof row.nearest_support === "number"
          ? row.nearest_support
          : null,
    nearestResistance:
      typeof row.nearestResistance === "number"
        ? row.nearestResistance
        : typeof row.nearest_resistance === "number"
          ? row.nearest_resistance
          : null,
  };
}

async function authenticate(request: Request) {
  const token = bearerToken(request);
  if (!token) return { error: json({ ok: false, error: "Authentication required" }, 401) };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user)
    return { error: json({ ok: false, error: "Invalid or expired session" }, 401) };
  return { supabaseAdmin, user: auth.user };
}

export const Route = createFileRoute("/api/opportunity-scanner")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await authenticate(request);
          if ("error" in auth) return auth.error;

          const controlsResult = await auth.supabaseAdmin
            .from("platform_controls")
            .select(
              "scanner_min_signal_confidence,scanner_min_data_confidence,scanner_min_risk_reward,scanner_max_candidate_age_minutes,scanner_weight_signal,scanner_weight_data,scanner_weight_risk_reward,scanner_weight_structure,scanner_weight_regime",
            )
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();
          if (controlsResult.error || !controlsResult.data) {
            throw new Error(`Scanner controls unavailable: ${controlsResult.error?.message ?? "missing row"}`);
          }
          const settings = settingsFromControls(controlsResult.data as unknown as ControlsRow);

          const evidenceResult = await auth.supabaseAdmin
            .from("signal_evidence")
            .select(
              "id,instrument_id,provider_symbol,timeframe,direction,regime,confidence_score,data_confidence_score,risk_reward_ratio,entry,stop_loss,take_profit_1,generated_at,data_to,no_trade_reasons,reasons,instrument:instruments(id,symbol,display_name,asset_class,category)",
            )
            .order("data_to", { ascending: false })
            .limit(1000);
          if (evidenceResult.error) throw evidenceResult.error;

          const structureResult = await auth.supabaseAdmin
            .from("market_structure_snapshots")
            .select("instrument_id,timeframe,data_to,analysis")
            .order("data_to", { ascending: false })
            .limit(1000);
          if (structureResult.error) throw structureResult.error;

          const structureByKey = new Map<string, ScannerStructure>();
          for (const raw of (structureResult.data ?? []) as unknown as StructureRow[]) {
            const key = `${raw.instrument_id}:${raw.timeframe}`;
            if (structureByKey.has(key)) continue;
            const structure = structureFromAnalysis(raw.analysis);
            if (structure) structureByKey.set(key, structure);
          }

          const latestByKey = new Map<string, EvidenceRow>();
          for (const raw of (evidenceResult.data ?? []) as unknown as EvidenceRow[]) {
            const key = `${raw.instrument_id}:${raw.timeframe}`;
            if (!latestByKey.has(key)) latestByKey.set(key, raw);
          }

          const evidence: ScannerEvidence[] = [];
          for (const row of latestByKey.values()) {
            const instrument = Array.isArray(row.instrument) ? row.instrument[0] : row.instrument;
            if (!instrument) continue;
            const key = `${row.instrument_id}:${row.timeframe}`;
            evidence.push({
              id: row.id,
              instrumentId: row.instrument_id,
              symbol: instrument.symbol || row.provider_symbol,
              displayName: instrument.display_name || instrument.symbol || row.provider_symbol,
              assetClass: String(instrument.asset_class),
              category: instrument.category,
              timeframe: row.timeframe,
              direction: row.direction,
              regime: row.regime,
              confidenceScore: Number(row.confidence_score),
              dataConfidenceScore:
                row.data_confidence_score == null ? null : Number(row.data_confidence_score),
              riskRewardRatio: row.risk_reward_ratio == null ? null : Number(row.risk_reward_ratio),
              entry: row.entry == null ? null : Number(row.entry),
              stopLoss: row.stop_loss == null ? null : Number(row.stop_loss),
              takeProfit1: row.take_profit_1 == null ? null : Number(row.take_profit_1),
              generatedAt: row.generated_at,
              dataTo: row.data_to,
              noTradeReasons: row.no_trade_reasons ?? [],
              reasons: row.reasons ?? [],
              structure: structureByKey.get(key) ?? null,
            });
          }

          const opportunities = rankOpportunities(evidence, settings, new Date());
          const qualified = opportunities.filter((item) => item.qualified).length;
          const rejected = opportunities.length - qualified;

          return json({
            ok: true,
            generatedAt: new Date().toISOString(),
            settings,
            summary: { total: opportunities.length, qualified, rejected },
            opportunities,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Opportunity scanner failed";
          return json({ ok: false, error: message }, 400);
        }
      },
      POST: async ({ request }) => {
        try {
          const auth = await authenticate(request);
          if ("error" in auth) return auth.error;

          const role = await auth.supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", auth.user.id)
            .in("role", ["super_admin", "admin"])
            .limit(1)
            .maybeSingle();
          if (role.error) throw role.error;
          if (!role.data) return json({ ok: false, error: "Administrator role required" }, 403);

          const body = (await request.json()) as { settings?: ScannerSettings };
          if (!body.settings) return json({ ok: false, error: "Scanner settings are required" }, 400);
          validateScannerSettings(body.settings);

          const controls = await auth.supabaseAdmin
            .from("platform_controls")
            .select("id")
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();
          if (controls.error || !controls.data?.id)
            throw new Error(`Platform controls unavailable: ${controls.error?.message ?? "missing row"}`);

          const writer = auth.supabaseAdmin as unknown as ScannerControlsWriter;
          const updateResult = await writer
            .from("platform_controls")
            .update(controlsPatch(body.settings))
            .eq("id", controls.data.id);
          if (updateResult.error)
            throw new Error(`Unable to update scanner controls: ${updateResult.error.message}`);

          return json({ ok: true, settings: body.settings });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to update scanner controls";
          return json({ ok: false, error: message }, 400);
        }
      },
    },
  },
});
