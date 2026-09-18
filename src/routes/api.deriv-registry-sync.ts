import { createFileRoute } from "@tanstack/react-router";
import { reconcileDerivSyntheticRegistry } from "../server/market-data/deriv-synthetic-registry.server";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  const authorization = request.headers.get("authorization")?.trim();
  return authorization === `Bearer ${expected}`;
}

export const Route = createFileRoute("/api/deriv-registry-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        try {
          const result = await reconcileDerivSyntheticRegistry();
          return Response.json(result, { status: 200 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown Deriv registry failure";
          console.error("Deriv registry reconciliation failed", error);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
