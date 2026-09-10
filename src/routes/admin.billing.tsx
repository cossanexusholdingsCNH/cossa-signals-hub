import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { useAdminUsers, useSubscriptionTiers } from "@/hooks/useCossa";
import { formatMoney } from "@/lib/cossa";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({
    meta: [
      { title: "Billing Administration — Cossa Signals" },
      {
        name: "description",
        content: "Plan configuration and subscriber distribution for Cossa Signals. Payments are processed server-side.",
      },
      { property: "og:title", content: "Billing Administration — Cossa Signals" },
      { property: "og:description", content: "Plan configuration and subscriber distribution." },
    ],
  }),
  component: AdminBilling,
});

function AdminBilling() {
  const { data: tiers, isLoading, isError } = useSubscriptionTiers();
  const { data: users } = useAdminUsers();

  const all = users ?? [];
  const paying = all.filter((u) => u.subscription_tier !== "free" && u.subscription_status === "active");
  const mrr = (tiers ?? []).reduce((sum, t) => {
    const count = all.filter(
      (u) => u.subscription_tier === t.tier && u.subscription_status === "active",
    ).length;
    return sum + count * t.price_monthly;
  }, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Billing"
        description="Plan configuration and subscriber distribution. Payments are handled by PayFast and reconciled server-side from verified webhook events — never from this interface."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active paying accounts" value={paying.length} tone="gold" />
        <StatCard label="Total accounts" value={all.length} />
        <StatCard label="Configured plans" value={(tiers ?? []).length} />
        <StatCard label="Recurring monthly" value={formatMoney(mrr, tiers?.[0]?.currency ?? "ZAR")} />
      </div>

      <Panel>
        <PanelHeader title="Plan configuration" subtitle="Entitlements are the database's source of truth" />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load plans.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading plans…</p>
        ) : (tiers ?? []).length === 0 ? (
          <EmptyState title="No plans configured" />
        ) : (
          <ul className="divide-y divide-border/60">
            {(tiers ?? []).map((t) => {
              const subscribers = all.filter((u) => u.subscription_tier === t.tier).length;
              return (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="numeric text-xs">
                      {t.price_monthly === 0 ? "Free" : `${formatMoney(t.price_monthly, t.currency)}/mo`} ·{" "}
                      {subscribers} account{subscribers === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Entitlements: {Object.keys(t.entitlements ?? {}).join(", ") || "none recorded"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Payment processing" subtitle="How money moves" />
        <ul className="space-y-2 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <li>· PayFast handles checkout and card data; no card details reach our servers.</li>
          <li>· Subscription state is written only by verified, signature-checked webhook events.</li>
          <li>· A plan can never be upgraded, extended or unlocked from the browser.</li>
          <li>· Entitlements are read from the database on every request, so revocation is immediate.</li>
        </ul>
      </Panel>
    </div>
  );
}
