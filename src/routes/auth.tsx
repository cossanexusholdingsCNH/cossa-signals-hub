import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { CossaMark } from "@/components/layout/CossaMark";
import { RISK_DISCLAIMER } from "@/lib/cossa";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Cossa Signals" },
      {
        name: "description",
        content:
          "Sign in or create a Cossa Signals account to access the Smart Signal Matrix, signal intelligence and performance analytics.",
      },
      { property: "og:title", content: "Sign in — Cossa Signals" },
      {
        property: "og:description",
        content: "Access evidence-based market intelligence from Cossa Tech.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "sign_in" | "sign_up" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "sign_in") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        void navigate({ to: "/dashboard" });
      } else if (mode === "sign_up") {
        if (!accepted) {
          setError("You must accept the risk disclosure and terms before creating an account.");
          return;
        }
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, disclaimer_accepted_at: new Date().toISOString() },
          },
        });
        if (err) throw err;
        setMessage("Account created. Check your email to confirm your address, then sign in.");
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (err) throw err;
        setMessage("If that address exists, a password reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center justify-center gap-2">
            <CossaMark className="size-7" />
            <span className="text-sm font-semibold tracking-[0.18em] uppercase">
              Cossa <span className="text-primary">Signals</span>
            </span>
          </Link>

          <div className="panel mt-8 p-6">
            <h1 className="text-lg font-semibold tracking-tight">
              {mode === "sign_in"
                ? "Sign in to your desk"
                : mode === "sign_up"
                  ? "Create your account"
                  : "Reset your password"}
            </h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Market intelligence for forex, synthetic indices and commodities.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "sign_up" ? (
                <Field
                  label="Full name"
                  value={fullName}
                  onChange={setFullName}
                  type="text"
                  autoComplete="name"
                  required
                />
              ) : null}
              <Field
                label="Email address"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                required
              />
              {mode !== "reset" ? (
                <Field
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  autoComplete={mode === "sign_up" ? "new-password" : "current-password"}
                  required
                />
              ) : null}

              {mode === "sign_up" ? (
                <label className="flex gap-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 size-3.5 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span>
                    I understand Cossa Signals provides analysis and education, not financial
                    advice, that trading carries substantial risk of loss, and that no outcome is
                    guaranteed.
                  </span>
                </label>
              ) : null}

              {error ? <p className="text-xs text-bearish">{error}</p> : null}
              {message ? <p className="text-xs text-primary">{message}</p> : null}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy
                  ? "Working…"
                  : mode === "sign_in"
                    ? "Sign in"
                    : mode === "sign_up"
                      ? "Create account"
                      : "Send reset link"}
              </button>
            </form>

            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
              {mode !== "sign_in" ? (
                <button
                  type="button"
                  onClick={() => setMode("sign_in")}
                  className="text-muted-foreground hover:text-primary"
                >
                  Back to sign in
                </button>
              ) : null}
              {mode !== "sign_up" ? (
                <button
                  type="button"
                  onClick={() => setMode("sign_up")}
                  className="text-muted-foreground hover:text-primary"
                >
                  Create an account
                </button>
              ) : null}
              {mode !== "reset" ? (
                <button
                  type="button"
                  onClick={() => setMode("reset")}
                  className="text-muted-foreground hover:text-primary"
                >
                  Forgot password?
                </button>
              ) : null}
            </div>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            {RISK_DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border-gold"
      />
    </label>
  );
}
