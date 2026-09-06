import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BrainCircuit,
  Gauge,
  LineChart,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import { PublicFooter, PublicNav } from "@/components/layout/PublicNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cossa Signals — Evidence-Based Market Intelligence" },
      {
        name: "description",
        content:
          "Cossa Signals delivers evidence-based trading intelligence for forex, synthetic indices and commodities: context, risk, regime and performance behind every signal.",
      },
      { property: "og:title", content: "Cossa Signals — Evidence-Based Market Intelligence" },
      {
        property: "og:description",
        content:
          "Signals with full context: entry, stop, targets, R:R, confidence, market regime, supporting evidence and honest performance history.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: ScrollText,
    title: "Context, never a bare call",
    body: "Every signal carries instrument, direction, entry, stop, targets, R:R, confidence, regime, strategy and the reasons it could fail.",
  },
  {
    icon: ShieldCheck,
    title: "A risk gate that can say no",
    body: "High confidence never bypasses risk control. Trades that fail exposure, spread, session or data checks are blocked before publication.",
  },
  {
    icon: BrainCircuit,
    title: "Signal council consensus",
    body: "Multiple analytical agents vote on each setup. Disagreement is shown, not hidden, so you can weigh conviction honestly.",
  },
  {
    icon: Gauge,
    title: "WAIT is a real answer",
    body: "Most instruments, most of the time, do not qualify. The platform is built to reject weak setups rather than manufacture activity.",
  },
  {
    icon: LineChart,
    title: "Performance without spin",
    body: "Results shown per strategy, instrument and timeframe — and flagged as statistically unreliable below thirty closed trades.",
  },
  {
    icon: Activity,
    title: "Live data integrity",
    body: "Feed freshness, service heartbeats and data provenance are visible. Stale data is labelled, not quietly served as live.",
  },
] as const;

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      <section className="hero-glow relative border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="eyebrow text-primary">Cossa Tech · Market Intelligence Division</p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-6xl">
            Market Intelligence.
            <br />
            <span className="text-primary">Evidence-Based Signals.</span>
            <br />
            Smarter Decisions.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Cossa Signals is a professional trading intelligence platform for forex, synthetic
            indices, commodities and shares. It combines indicators, market regime detection,
            statistical models and layered risk control — then explains the reasoning behind every
            decision, including the decision not to trade.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create your account
            </Link>
            <Link
              to="/pricing"
              className="rounded-md border border-border-gold px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-gold-dim"
            >
              View plans
            </Link>
            <Link
              to="/academy"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-border-gold"
            >
              Explore the Academy
            </Link>
          </div>
          <p className="mt-8 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Cossa Signals is an analytical and educational platform. It does not guarantee outcomes,
            does not place trades on your behalf and does not provide financial advice.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="eyebrow text-muted-foreground">What makes it different</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Built like an institutional desk, not a signal group
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <article key={p.title} className="panel p-5">
                <Icon className="size-5 text-primary" />
                <h3 className="mt-4 text-sm font-semibold">{p.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border bg-panel">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="eyebrow text-muted-foreground">Coverage</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Forex, synthetic indices, commodities and indices
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Major and minor currency pairs, volatility indices (R_10 through R_100 and 1-second
            variants), boom and crash indices, bull and bear markets, step index, range break
            indices, metals and expanding coverage of shares and commodities.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              "EURUSD",
              "GBPUSD",
              "USDJPY",
              "GBPJPY",
              "XAUUSD",
              "R_10",
              "R_25",
              "R_50",
              "R_75",
              "R_100",
              "1HZ75V",
              "BOOM500",
              "BOOM1000",
              "CRASH500",
              "CRASH1000",
              "BULL",
              "BEAR",
              "STEPIDX",
              "RDBULL",
            ].map((s) => (
              <span
                key={s}
                className="numeric rounded border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="panel-gold p-8 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Trade with evidence in front of you
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Open an account to access the Smart Signal Matrix, signal intelligence pages,
            performance analytics, watchlists and the education hub.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
