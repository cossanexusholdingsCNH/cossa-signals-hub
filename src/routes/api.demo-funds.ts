import { createFileRoute } from "@tanstack/react-router";

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

export const Route = createFileRoute("/api/demo-funds")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = bearerToken(request);
          if (!token) return json({ ok: false, error: "Authentication required" }, 401);

          const [{ supabaseAdmin }, { topUpDemoTradingAccount }] = await Promise.all([
            import("@/integrations/supabase/client.server"),
            import("@/server/execution/demo-account.server"),
          ]);
          const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
          if (authError || !auth.user) return json({ ok: false, error: "Invalid session" }, 401);

          const body = (await request.json()) as Record<string, unknown>;
          const accountId = typeof body.accountId === "string" ? body.accountId : "";
          const amount = Number(body.amount);
          if (!accountId) return json({ ok: false, error: "accountId is required" }, 400);

          const result = await topUpDemoTradingAccount({
            accountId,
            userId: auth.user.id,
            amount,
          });
          return json({ ok: true, result });
        } catch (error) {
          return json(
            { ok: false, error: error instanceof Error ? error.message : "Demo top up failed" },
            400,
          );
        }
      },
    },
  },
});
