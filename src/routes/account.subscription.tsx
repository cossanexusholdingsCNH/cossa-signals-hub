import { createFileRoute, Link } from "@tanstack/react-router";

import { DataRow, PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { useMySubscription, useSubscriptionTiers } from "@/hooks/useCossa";
import { formatDate, formatMoney } from "@/lib/cossa";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription — Cossa Signals" },
      {
        name: "description",
        content: "Your Cossa Signals plan, entitlements and billing period. Access rules are enforced by the database.",
      },
      { property: "og:title", content: "Subscription — Cossa Signals" },
      { property: "og:description", content: "Your plan, entitlements and billing period." },
    ],
  }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { data: subscription, isLoading, isError } = useMySubscription(user?.id);
  const { data: tiers } = useSubscriptionTiers();

  const currentTier = subscription?.tier ?? profile?.subscription_tier ?? "free";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Billing"
        title="Subscription"
        description="Your plan decides how quickly you see signals and how much history you can review. Entitlements are read from the database — the browser cannot unlock anything."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Current plan" subtitle="As recorded by the platform" />
          {isError ? (
            <p className="px-4 py-8 text-center text-sm text-bearish">Unable to load your subscription.</p>
          ) : isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading subscription…</p>
          ) : (
            <div className="px-4 py-2">
              <DataRow label="Plan" value={currentTier} />
              <DataRow label="Status" value={subscription?.status ?? profile?.subscription_status ?? "free"} />
              <DataRow label="Provider" value={subscription?.provider ?? "—"} />
              <DataRow label="Period start" value={formatDate(subscription?.current_period_start)} />
              <DataRow label="Renews / ends" value={formatDate(subscription?.current_period_end)} />
              <DataRow label="Cancelled at" value={formatDate(subscription?.cancelled_at)} />
            </div>
          )}
          <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
            Plan changes are processed by PayFast and written server-side from verified webhook events.
            To upgrade, downgrade or cancel, contact Cossa Tech support — nothing is changed from this page.
          </p>
        </Panel>

        <Panel>
          <PanelHeader title="What each plan includes" subtitle="Database-driven entitlements" />
          <ul className="divide-y divide-border/60">
            {(tiers ?? []).map((t) => (
              <li
                key={t.id}
                className={cn("px-4 py-3", t.tier === currentTier ? "bg-gold-dim/40" : "")}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">
                    {t.name}
                    {t.tier === currentTier ? (
                      <span className="ml-2 text-[10px] tracking-widest text-primary uppercase">
                        Your plan
                      </span>
                    ) : null}
                  </span>
                  <span className="numeric text-xs">
                    {t.price_monthly === 0 ? "Free" : `${formatMoney(t.price_monthly, t.currency)}/mo`}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {t.features.map((f) => (
                    <li key={f} className="text-[11px] text-muted-foreground">
                      · {f}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {(tiers ?? []).length === 0 ? (
              <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                No plans configured yet.
              </li>
            ) : null}
          </ul>
          <div className="border-t border-border px-4 py-3">
            <Link to="/pricing" className="text-xs text-primary hover:underline">
              Compare plans →
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
