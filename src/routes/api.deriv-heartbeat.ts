import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export const Route = createFileRoute("/api/deriv-heartbeat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const [{ runEnabledDerivHeartbeat }, { acquireSchedulerLease, releaseSchedulerLease }] =
          await Promise.all([
            import("@/server/market-data/deriv-heartbeat.server"),
            import("@/server/runtime/scheduler-lease.server"),
          ]);
        const lease = await acquireSchedulerLease("deriv-heartbeat", 55);
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
