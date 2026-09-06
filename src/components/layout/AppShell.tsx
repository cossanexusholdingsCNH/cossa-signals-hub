import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BookOpen,
  Grid3x3,
  LayoutDashboard,
  LineChart,
  Menu,
  Radio,
  Settings,
  Shield,
  Star,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { RISK_DISCLAIMER } from "@/lib/cossa";
import { usePlatformControls } from "@/hooks/useCossa";
import { useAuth, useRoles } from "@/hooks/useAuth";
import { CossaMark } from "@/components/layout/CossaMark";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard },
  { to: "/matrix", label: "Smart Matrix", icon: Grid3x3 },
  { to: "/signals", label: "Signals", icon: Radio },
  { to: "/performance", label: "Performance", icon: BarChart3 },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/academy", label: "Academy", icon: BookOpen },
  { to: "/account", label: "Account", icon: Settings },
] as const;

export function KillSwitchBanner() {
  const { data: controls } = usePlatformControls();
  if (!controls) return null;
  if (controls.signals_enabled && !controls.maintenance_mode) return null;
  return (
    <div className="border-b border-caution/40 bg-caution/10 px-4 py-2.5 text-center text-xs font-medium text-caution">
      {controls.maintenance_mode
        ? (controls.emergency_message ??
          "Cossa Signals is in maintenance mode. Historical records remain visible.")
        : "Signal delivery temporarily paused by Cossa Signals risk controls. Historical records remain visible."}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const isStaff = (roles ?? []).some((r) =>
    ["super_admin", "admin", "analyst", "support"].includes(r),
  );
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
      {isStaff ? (
        <>
          <div className="mx-3 my-2 h-px bg-sidebar-border" />
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
            )}
          >
            <Shield className="size-4 shrink-0" />
            Administration
          </Link>
        </>
      ) : null}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <KillSwitchBanner />

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground lg:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <CossaMark className="size-6" />
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">
            Cossa <span className="text-primary">Signals</span>
          </span>
        </Link>
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
          <Activity className="size-3.5 text-primary" />
          Cossa Tech · Cossa Nexus Holdings
        </span>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border-gold hover:text-primary"
        >
          Sign out
        </button>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          <div className="sticky top-14">{nav}</div>
        </aside>

        {open ? (
          <div className="fixed inset-0 top-14 z-30 bg-background/80 lg:hidden">
            <div className="w-64 border-r border-sidebar-border bg-sidebar">{nav}</div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</div>
          <footer className="mt-8 border-t border-border px-4 py-5 sm:px-6">
            <p className="mx-auto max-w-4xl text-[11px] leading-relaxed text-muted-foreground">
              {RISK_DISCLAIMER}
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
