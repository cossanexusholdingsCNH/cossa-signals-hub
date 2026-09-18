import { createFileRoute } from "@tanstack/react-router";
import {
  importDiscoveredDerivSyntheticRegistry,
  reconcileDerivSyntheticRegistry,
} from "../server/market-data/deriv-synthetic-registry.server";

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
          let payload: { action?: string; providerSymbols?: string[] } = {};
          const contentType = request.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) payload = await request.json();

          if (!payload.action || payload.action === "discover") {
            return Response.json(await reconcileDerivSyntheticRegistry(), { status: 200 });
          }

          if (payload.action === "import") {
            return Response.json(
              await importDiscoveredDerivSyntheticRegistry({ providerSymbols: payload.providerSymbols }),
              { status: 200 },
            );
          }

          return Response.json({ ok: false, error: "Unsupported registry action" }, { status: 400 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown Deriv registry failure";
          console.error("Deriv registry reconciliation failed", error);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
