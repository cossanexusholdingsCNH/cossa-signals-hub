import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  component: AccountLayout,
});

const TABS = [
  { to: "/account", label: "Profile" },
  { to: "/account/subscription", label: "Subscription" },
  { to: "/account/alerts", label: "Alerts" },
] as const;

function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RequireAuth>
      <div className="space-y-5">
        <div className="flex gap-1 rounded-lg border border-border bg-panel p-1">
          {TABS.map((t) => {
            const active = pathname === t.to || (t.to === "/account" && pathname === "/account/");
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors sm:px-5",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </div>
    </RequireAuth>
  );
}
