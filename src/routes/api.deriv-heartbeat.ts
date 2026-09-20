import { createFileRoute } from "@tanstack/react-router";

type SchedulerTokenRpcResult = {
  data: boolean | null;
  error: { message: string } | null;
};

async function authorizedBySchedulerVault(token: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      functionName: string,
      args: Record<string, unknown>,
    ) => PromiseLike<SchedulerTokenRpcResult>;
    const { data, error } = await rpc("verify_scheduler_token", { p_token: token });
    if (error) {
      console.error(`[Deriv heartbeat auth] Scheduler token verification failed: ${error.message}`);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error(
      `[Deriv heartbeat auth] Scheduler token verification failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return false;
  }
}

async function authorized(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const token = authorization.slice("Bearer ".length).trim();
  if (!token || token.length > 512) return false;

  const expected = process.env.CRON_SECRET;
  if (expected && token === expected) return true;

  return authorizedBySchedulerVault(token);
}

export const Route = createFileRoute("/api/deriv-heartbeat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await authorized(request))) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const [{ runEnabledDerivHeartbeat }, { acquireSchedulerLease, releaseSchedulerLease }] =
          await Promise.all([
            import("@/server/market-data/deriv-heartbeat.server"),
            import("@/server/runtime/scheduler-lease.server"),
          ]);
        const lease = await acquireSchedulerLease("deriv-heartbeat", 150);
        if (!lease.acquired) {
          return Response.json(
            { ok: true, skipped: true, reason: "heartbeat already running" },
            { headers: { "cache-control": "no-store" } },
          );
        }

        try {
          const result = await runEnabledDerivHeartbeat();
          return Response.json(result, {
            status: result.ok ? 200 : 503,
            headers: { "cache-control": "no-store" },
          });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Heartbeat failed" },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        } finally {
          await releaseSchedulerLease("deriv-heartbeat", lease.holder);
        }
      },
    },
  },
});
