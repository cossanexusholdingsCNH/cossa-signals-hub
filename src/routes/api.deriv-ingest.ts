import { createFileRoute } from "@tanstack/react-router";

import { runEnabledDerivIngestion } from "@/server/market-data/deriv-live-ingestion.server";
import {
  acquireSchedulerLease,
  releaseSchedulerLease,
} from "@/server/runtime/scheduler-lease.server";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${expected}`;
}

export const Route = createFileRoute("/api/deriv-ingest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const lease = await acquireSchedulerLease("deriv-full-ingestion", 480);
        if (!lease.acquired) {
          return Response.json(
            { ok: true, skipped: true, reason: "full ingestion already running" },
            { headers: { "cache-control": "no-store" } },
          );
        }

        try {
          const result = await runEnabledDerivIngestion();
          return Response.json(result, {
            status: result.ok ? 200 : 503,
            headers: { "cache-control": "no-store" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Deriv ingestion failed";
          console.error("Deriv ingestion failed", error);
          return Response.json(
            { ok: false, error: message },
            {
              status: 503,
              headers: { "cache-control": "no-store" },
            },
          );
        } finally {
          await releaseSchedulerLease("deriv-full-ingestion", lease.holder);
        }
      },
    },
  },
});
