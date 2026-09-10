import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { useAdminUsers } from "@/hooks/useCossa";
import { formatDate } from "@/lib/cossa";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User Administration — Cossa Signals" },
      {
        name: "description",
        content: "Staff view of registered Cossa Signals accounts, plans and subscription status.",
      },
      { property: "og:title", content: "User Administration — Cossa Signals" },
      { property: "og:description", content: "Accounts, plans and subscription status." },
    ],
  }),
  component: AdminUsers,
});

function AdminUsers() {
  const { data: users, isLoading, isError } = useAdminUsers();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const all = users ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.country ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  const all = users ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Read-only account overview. Role changes and plan changes are made server-side, never from this page."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Accounts" value={all.length} tone="gold" />
        <StatCard label="Free" value={all.filter((u) => u.subscription_tier === "free").length} />
        <StatCard label="Basic" value={all.filter((u) => u.subscription_tier === "basic").length} />
        <StatCard label="Pro" value={all.filter((u) => u.subscription_tier === "pro").length} />
      </div>

      <Panel>
        <PanelHeader
          title="Registered accounts"
          subtitle={`${rows.length} shown`}
          action={
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, country"
              className="w-56 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-border-gold"
            />
          }
        />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load accounts.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading accounts…</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No accounts match" description="Adjust your search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Name", "Email", "Country", "Plan", "Status", "Last login", "Joined"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{u.full_name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{u.country ?? "—"}</td>
                    <td className="px-3 py-2.5">{u.subscription_tier}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{u.subscription_status}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(u.last_login_at)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
