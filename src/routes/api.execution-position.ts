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

export const Route = createFileRoute("/api/execution-position")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = bearerToken(request);
          if (!token) return json({ ok: false, error: "Authentication required" }, 401);

          const [{ supabaseAdmin }, { refreshDemoPosition, closeDemoPosition }] = await Promise.all([
            import("@/integrations/supabase/client.server"),
            import("@/server/execution/execution-lifecycle.server"),
          ]);

          const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
          if (authError || !auth.user) return json({ ok: false, error: "Invalid session" }, 401);

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
