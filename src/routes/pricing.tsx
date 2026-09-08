import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { PublicFooter, PublicNav } from "@/components/layout/PublicNav";
import { EmptyState, PageHeader, Panel, RiskDisclaimer } from "@/components/cossa/primitives";
import { useSubscriptionTiers } from "@/hooks/useCossa";
import { formatMoney } from "@/lib/cossa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Cossa Signals" },
      {
        name: "description",
        content:
          "Free, Basic and Pro access to Cossa Signals market intelligence. Entitlements are enforced by the database, never by the browser.",
      },
      { property: "og:title", content: "Pricing — Cossa Signals" },
      { property: "og:description", content: "Transparent plans for evidence-based market intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { data: tiers, isLoading, isError } = useSubscriptionTiers();

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Access"
          title="Plans"
          description="Every plan sees the same engine and the same honesty. Higher tiers reduce delay and open more history — access rules live in the database, so nothing can be unlocked from the browser."
        />

        {isError ? (
          <p className="py-10 text-center text-sm text-bearish">Unable to load plans right now.</p>
        ) : isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading plans…</p>
        ) : (tiers ?? []).length === 0 ? (
          <Panel>
            <EmptyState title="No plans published yet" description="Pricing appears once tiers are configured." />
          </Panel>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {(tiers ?? []).map((t) => {
              const highlight = t.tier === "basic";
              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex flex-col p-5",
                    highlight ? "panel-gold" : "panel",
                  )}
                >
                  <p className="eyebrow">{t.name}</p>
                  <p className="numeric mt-2 text-2xl font-semibold">
                    {t.price_monthly === 0 ? "Free" : formatMoney(t.price_monthly, t.currency)}
                    {t.price_monthly > 0 ? (
                      <span className="text-xs font-normal text-muted-foreground"> / month</span>
                    ) : null}
                  </p>
                  {t.description ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                  ) : null}
                  <ul className="mt-4 space-y-2">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2 text-xs text-foreground/90">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/auth"
                    className={cn(
                      "mt-5 rounded-md px-3 py-2 text-center text-xs font-semibold transition-colors",
                      highlight
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border text-foreground hover:border-border-gold hover:text-primary",
                    )}
                  >
                    Get started
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <Panel className="mt-6 px-4 py-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Billing is processed by PayFast. Subscription state is written server-side from verified
            webhook events — a plan is never upgraded from the browser.
          </p>
        </Panel>

        <div className="mt-6">
          <RiskDisclaimer />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
