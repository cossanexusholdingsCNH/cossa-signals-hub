import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
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
            .select("provider_symbol,is_primary,market_data_providers!inner(slug,supports_streaming)")
            .eq("instrument_id", instrumentId)
            .eq("enabled", true)
            .order("is_primary", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          if (!data) return json({ ok: true, stream: null });

          const provider = data.market_data_providers as unknown as {
            slug?: string;
            supports_streaming?: boolean;
          };

          return json({
            ok: true,
            stream: {
              provider: provider.slug ?? null,
              providerSymbol: data.provider_symbol,
              supportsStreaming: provider.supports_streaming === true,
            },
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
