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

export const Route = createFileRoute("/api/demo-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = bearerToken(request);
          if (!token) return json({ ok: false, error: "Authentication required" }, 401);

          const [{ supabaseAdmin }, { bootstrapDemoTradingAccount }] = await Promise.all([
            import("@/integrations/supabase/client.server"),
            import("@/server/execution/demo-account.server"),
          ]);

          const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
          if (authError || !auth.user) return json({ ok: false, error: "Invalid session" }, 401);

          const body = (await request.json()) as Record<string, unknown>;
          const result = await bootstrapDemoTradingAccount({
            userId: auth.user.id,
            startingBalance: Number(body.startingBalance),
            currency: typeof body.currency === "string" ? body.currency : "USD",
          });

          return json({ ok: true, result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Demo account setup failed";
          return json({ ok: false, error: message }, 400);
        }
      },
    },
  },
});
