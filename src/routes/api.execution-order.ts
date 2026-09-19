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

export const Route = createFileRoute("/api/execution-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = bearerToken(request);
          if (!token) return json({ ok: false, error: "Authentication required" }, 401);

          const [
            { supabaseAdmin },
            { createManualOrderIntent },
            { evaluatePaperExecution },
            { fillApprovedDemoOrder },
            { refreshDemoRiskState },
          ] = await Promise.all([
            import("@/integrations/supabase/client.server"),
            import("@/server/execution/manual-order.server"),
            import("@/server/execution/paper-coordinator.server"),
            import("@/server/execution/execution-lifecycle.server"),
            import("@/server/execution/demo-account.server"),
          ]);

          const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
          if (authError || !auth.user) return json({ ok: false, error: "Invalid session" }, 401);

          const body = (await request.json()) as Record<string, unknown>;
          const tradingAccountId = String(body.tradingAccountId ?? "");
          if (!tradingAccountId)
            return json({ ok: false, error: "Trading account is required" }, 400);

          const account = await supabaseAdmin
            .from("trading_accounts")
            .select("id,account_environment")
            .eq("id", tradingAccountId)
            .eq("user_id", auth.user.id)
            .single();
          if (account.error || !account.data)
            return json({ ok: false, error: "Trading account was not found" }, 404);

          if (account.data.account_environment === "demo") {
            await refreshDemoRiskState(tradingAccountId, auth.user.id);
          }

          const order = await createManualOrderIntent({
            userId: auth.user.id,
            tradingAccountId,
            instrumentId: String(body.instrumentId ?? ""),
            side: body.side === "sell" ? "sell" : "buy",
            requestedAmount: Number(body.requestedAmount),
            requestedEntry: Number(body.requestedEntry),
            stopLoss: Number(body.stopLoss),
            takeProfit1: Number(body.takeProfit1),
            signalId: typeof body.signalId === "string" ? body.signalId : null,
            signalEvidenceId:
              typeof body.signalEvidenceId === "string" ? body.signalEvidenceId : null,
            riskPct: body.riskPct == null ? null : Number(body.riskPct),
          });

          if (order.execution_mode === "paper_auto") {
            const decision = await evaluatePaperExecution({
              orderId: order.id,
              userId: auth.user.id,
            });
            const lifecycle = decision.approved
              ? await fillApprovedDemoOrder(order.id, auth.user.id)
              : null;
            return json({ ok: true, order, decision, lifecycle });
          }

          return json({
            ok: true,
            order,
            decision: {
              approved: false,
              confirmationRequired: true,
              message: "Live order created and is awaiting explicit confirmation.",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Execution request failed";
          return json({ ok: false, error: message }, 400);
        }
      },
    },
  },
});
