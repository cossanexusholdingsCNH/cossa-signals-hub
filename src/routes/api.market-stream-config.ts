import { createFileRoute } from "@tanstack/react-router";

const TERMINAL_TIMEFRAMES = [
  ["1m", 60],
  ["5m", 300],
  ["15m", 900],
  ["30m", 1800],
  ["1h", 3600],
  ["4h", 14400],
] as const;

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

async function hydrateTerminalCandles(input: {
  instrumentId: string;
  providerId: string;
  providerSymbol: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchDerivCandles } = await import("@/server/market-data/deriv");
  const nowSeconds = Math.floor(Date.now() / 1000);

  const results = await Promise.allSettled(
    TERMINAL_TIMEFRAMES.map(async ([timeframe, granularity]) => {
      const raw = await fetchDerivCandles(input.providerSymbol, granularity, 220);
      const rows = raw
        .filter((candle) => candle.epoch + granularity <= nowSeconds + 2)
        .slice(-200)
        .map((candle) => ({
          instrument_id: input.instrumentId,
          provider_id: input.providerId,
          provider_symbol: input.providerSymbol,
          timeframe,
          open_time: new Date(candle.epoch * 1000).toISOString(),
          close_time: new Date((candle.epoch + granularity) * 1000).toISOString(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          is_closed: true,
          is_demo: false,
          metadata: { source: "deriv_terminal_hydration", source_epoch: candle.epoch },
        }));
      if (!rows.length) return { timeframe, written: 0 };

      const { error } = await supabaseAdmin.from("market_candles").upsert(rows, {
        onConflict: "instrument_id,provider_id,timeframe,open_time",
        ignoreDuplicates: false,
      });
      if (error) throw new Error(`${timeframe}: ${error.message}`);
      return { timeframe, written: rows.length };
    }),
  );

  return results.map((result, index) =>
    result.status === "fulfilled"
      ? { ok: true, ...result.value }
      : {
          ok: false,
          timeframe: TERMINAL_TIMEFRAMES[index][0],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        },
  );
}

export const Route = createFileRoute("/api/market-stream-config")({
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
          if (!instrumentId) return json({ ok: false, error: "instrumentId is required" }, 400);

          const { data, error } = await supabaseAdmin
            .from("instrument_provider_mappings")
            .select("provider_id,provider_symbol,is_primary,market_data_providers!inner(slug,supports_streaming)")
            .eq("instrument_id", instrumentId)
            .eq("enabled", true)
            .order("is_primary", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          if (!data) return json({ ok: true, stream: null });

          const provider = data.market_data_providers as unknown as {
            slug?: string | null;
            supports_streaming?: boolean;
          };

          let timeframeHydration: Array<Record<string, unknown>> = [];
          if (provider.slug === "deriv") {
            timeframeHydration = await hydrateTerminalCandles({
              instrumentId,
              providerId: data.provider_id,
              providerSymbol: data.provider_symbol,
            });
          }

          return json({
            ok: true,
            stream: {
              provider: provider.slug ?? null,
              providerSymbol: data.provider_symbol,
              supportsStreaming: provider.supports_streaming === true,
            },
            timeframeHydration,
          });
        } catch (error) {
          return json(
            { ok: false, error: error instanceof Error ? error.message : "Stream config failed" },
            400,
          );
        }
      },
    },
  },
});
