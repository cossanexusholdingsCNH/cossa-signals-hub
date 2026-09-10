import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { RequireStaff } from "@/components/layout/RequireStaff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/signals", label: "Signals" },
  { to: "/admin/instruments", label: "Instruments" },
  { to: "/admin/strategies", label: "Strategies & models" },
  { to: "/admin/performance", label: "Performance" },
  { to: "/admin/system", label: "System health" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/billing", label: "Billing" },
  { to: "/admin/audit", label: "Audit log" },
] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RequireAuth>
      <RequireStaff>
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-panel p-1">
            {TABS.map((t) => {
              const active =
                t.to === "/admin"
                  ? pathname === "/admin" || pathname === "/admin/"
                  : pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition-colors",
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
      </RequireStaff>
    </RequireAuth>
  );
}
