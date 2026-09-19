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

async function authenticatedUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return { error: json({ ok: false, error: "Authentication required" }, 401) };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return { error: json({ ok: false, error: "Invalid session" }, 401) };
  return { supabaseAdmin, user: auth.user };
}

export const Route = createFileRoute("/api/execution-position")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const auth = await authenticatedUser(request);
          if ("error" in auth) return auth.error;

          const { data: positions, error } = await auth.supabaseAdmin
            .from("execution_positions")
            .select(
              "id,order_id,trading_account_id,instrument_id,environment,provider,side,status,quantity,entry_price,current_price,stop_loss,take_profit_1,unrealized_pnl,realized_pnl,close_price,close_reason,opened_at,closed_at,created_at,metadata",
            )
            .eq("user_id", auth.user.id)
            .order("created_at", { ascending: false })
            .limit(100);
          if (error) throw error;

          return json({ ok: true, positions: positions ?? [] });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load positions";
          return json({ ok: false, error: message }, 400);
        }
      },
      POST: async ({ request }) => {
        try {
          const auth = await authenticatedUser(request);
          if ("error" in auth) return auth.error;

          const { refreshDemoPosition, closeDemoPosition } = await import(
            "@/server/execution/execution-lifecycle.server"
          );
          const body = (await request.json()) as Record<string, unknown>;
          const positionId = String(body.positionId ?? "");
          const action = body.action === "close" ? "close" : "refresh";
          if (!positionId) return json({ ok: false, error: "Position id is required" }, 400);

          const result =
            action === "close"
              ? await closeDemoPosition(positionId, auth.user.id)
              : await refreshDemoPosition(positionId, auth.user.id);

          return json({ ok: true, action, result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Position action failed";
          return json({ ok: false, error: message }, 400);
        }
      },
    },
  },
});
