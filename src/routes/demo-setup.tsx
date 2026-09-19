import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/demo-setup")({ component: DemoSetupPage });

function DemoSetupPage() {
  return (
    <RequireAuth>
      <DemoSetup />
    </RequireAuth>
  );
}

function DemoSetup() {
  const [startingBalance, setStartingBalance] = useState("10000");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function setup() {
    setResult(null);
    const balance = Number(startingBalance);
    if (!Number.isFinite(balance) || balance <= 0) {
      setResult({ ok: false, message: "Enter a positive virtual starting balance." });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Sign in again.");

      const response = await fetch("/api/demo-account", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startingBalance: balance, currency }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        result?: { accountId?: string };
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error ?? "Demo account setup failed");

      setResult({
        ok: true,
        message: `Deriv Demo account ready${payload.result?.accountId ? ` (${payload.result.accountId})` : ""}. Virtual funds are simulation-only.`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Demo account setup failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Demo execution readiness
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Set up Deriv Demo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create the server-controlled Demo trading account and risk baseline required for safe
          execution testing. These are virtual funds only; no real-money account is connected here.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Virtual starting balance
            <input
              type="number"
              min="1"
              step="any"
              value={startingBalance}
              onChange={(event) => setStartingBalance(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background p-2.5 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Currency
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="mt-1 w-full rounded-md border bg-background p-2.5 text-sm text-foreground"
            >
              <option value="USD">USD</option>
              <option value="ZAR">ZAR</option>
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-border p-3 text-xs text-muted-foreground">
          Default controls: 1% maximum risk per trade, 3% maximum daily loss and 3 maximum open
          positions. The execution engine still performs every risk check before a Demo order can
          fill.
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => void setup()}
          className="mt-4 w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Setting up…" : "Create / refresh Deriv Demo account"}
        </button>

        {result ? (
          <div
            className={`mt-3 rounded-md border p-3 text-xs ${result.ok ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive"}`}
          >
            {result.message}
          </div>
        ) : null}
      </section>

      <Link
        to="/trading"
        className="inline-flex rounded-md border border-border-gold px-4 py-2 text-sm font-medium text-primary"
      >
        Open Trading Terminal
      </Link>
    </div>
  );
}
