import { createFileRoute } from "@tanstack/react-router";

const TIMEFRAME_SECONDS = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
} as const;

type SupportedTimeframe = keyof typeof TIMEFRAME_SECONDS;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function supportedTimeframe(value: string | null): value is SupportedTimeframe {
  return Boolean(value && value in TIMEFRAME_SECONDS);
}

export const Route = createFileRoute("/api/trading-candles")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const token = bearerToken(request);
          if (!token) return json({ ok: false, error: "Authentication required" }, 401);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
          if (authError || !auth.user) return json({ ok: false, error: "Invalid session" }, 401);

          const url = new URL(request.url);
          const instrumentId = url.searchParams.get("instrumentId")?.trim();
          const timeframe = url.searchParams.get("timeframe")?.trim() ?? null;
          if (!instrumentId) return json({ ok: false, error: "instrumentId is required" }, 400);
          if (!supportedTimeframe(timeframe)) {
            return json({ ok: false, error: "Unsupported timeframe" }, 400);
          }

          const { data: mapping, error: mappingError } = await supabaseAdmin
            .from("instrument_provider_mappings")
            .select("provider_symbol,is_primary,market_data_providers!inner(slug)")
            .eq("instrument_id", instrumentId)
            .eq("enabled", true)
            .order("is_primary", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (mappingError) throw mappingError;
          if (!mapping) return json({ ok: false, error: "No enabled market-data mapping" }, 404);

          const provider = mapping.market_data_providers as unknown as { slug?: string };
          if (provider.slug !== "deriv") {
            return json({ ok: false, error: "Trading candles currently require the Deriv provider" }, 400);
          }

          const { fetchDerivCandles } = await import("@/server/market-data/deriv");
          const granularity = TIMEFRAME_SECONDS[timeframe];
          const raw = await fetchDerivCandles(mapping.provider_symbol, granularity, 240);
          const nowSeconds = Math.floor(Date.now() / 1000);
          const candles = raw
            .filter((candle) => candle.epoch + granularity <= nowSeconds + 2)
            .slice(-220)
            .map((candle) => ({
              openTime: new Date(candle.epoch * 1000).toISOString(),
              closeTime: new Date((candle.epoch + granularity) * 1000).toISOString(),
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            }));

          return json({
            ok: true,
            source: "deriv",
            timeframe,
            granularitySeconds: granularity,
            providerSymbol: mapping.provider_symbol,
            candles,
          });
        } catch (error) {
          return json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Unable to load trading candles",
            },
            400,
          );
        }
      },
    },
  },
});
