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

export const Route = createFileRoute("/api/account-state")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const token = bearerToken(request);
          if (!token) return json({ ok: false, error: "Authentication required" }, 401);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
          if (authError || !auth.user) return json({ ok: false, error: "Invalid session" }, 401);

          const url = new URL(request.url);
          const requestedAccountId = url.searchParams.get("accountId");

          let accountQuery = supabaseAdmin
            .from("trading_accounts")
            .select(
              "id,provider,provider_account_ref,account_label,account_environment,execution_mode,enabled,currency,emergency_stop,max_risk_per_trade_pct,max_daily_loss_pct,max_open_positions",
            )
            .eq("user_id", auth.user.id)
            .eq("enabled", true);

          if (requestedAccountId) accountQuery = accountQuery.eq("id", requestedAccountId);
          const accountResult = await accountQuery.order("account_environment").limit(1).maybeSingle();
          if (accountResult.error) throw new Error(accountResult.error.message);
          if (!accountResult.data) return json({ ok: true, account: null });

          const account = accountResult.data;
          const [snapshotResult, positionsResult] = await Promise.all([
            supabaseAdmin
              .from("trading_account_snapshots")
              .select("balance,equity,available_balance,currency,open_positions,provider_timestamp,captured_at,metadata")
              .eq("trading_account_id", account.id)
              .order("captured_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabaseAdmin
              .from("execution_positions")
              .select("status,realized_pnl,unrealized_pnl,opened_at,closed_at")
              .eq("trading_account_id", account.id),
          ]);

          if (snapshotResult.error) throw new Error(snapshotResult.error.message);
          if (positionsResult.error) throw new Error(positionsResult.error.message);

          const positions = positionsResult.data ?? [];
          const open = positions.filter((row) => ["opening", "open", "closing"].includes(row.status));
          const closed = positions.filter((row) => row.status === "closed");
          const wins = closed.filter((row) => Number(row.realized_pnl ?? 0) > 0).length;
          const losses = closed.filter((row) => Number(row.realized_pnl ?? 0) < 0).length;
          const breakEven = closed.length - wins - losses;
          const realizedPnl = closed.reduce((sum, row) => sum + Number(row.realized_pnl ?? 0), 0);
          const unrealizedPnl = open.reduce((sum, row) => sum + Number(row.unrealized_pnl ?? 0), 0);
          const snapshot = snapshotResult.data;
          const balance = Number(snapshot?.balance ?? 0);
          const equity = Number(snapshot?.equity ?? balance + unrealizedPnl);
          const availableBalance = Number(snapshot?.available_balance ?? balance);
          const totalPnl = realizedPnl + unrealizedPnl;
          const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;

          return json({
            ok: true,
            account: {
              ...account,
              balance,
              equity,
              availableBalance,
              realizedPnl,
              unrealizedPnl,
              totalPnl,
              openPositions: open.length,
              closedTrades: closed.length,
              wins,
              losses,
              breakEven,
              winRate,
              snapshotAt: snapshot?.captured_at ?? null,
              providerTimestamp: snapshot?.provider_timestamp ?? null,
              virtualFunds: Boolean((snapshot?.metadata as Record<string, unknown> | null)?.virtual_funds),
            },
          });
        } catch (error) {
          return json(
            { ok: false, error: error instanceof Error ? error.message : "Unable to load account state" },
            500,
          );
        }
      },
    },
  },
});
