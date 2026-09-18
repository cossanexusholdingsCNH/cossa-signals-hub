import { createFileRoute } from "@tanstack/react-router";

import { runDerivLiveIngestion } from "@/server/market-data/deriv-live-ingestion.server";

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

        try {
          const result = await runDerivLiveIngestion({
            providerSymbol: "1HZ100V",
            timeframe: "5m",
          });
          return Response.json(result, {
            status: 200,
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
        }
      },
    },
  },
});
