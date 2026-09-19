import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BookOpen,
  CandlestickChart,
  Grid3x3,
  LayoutDashboard,
  LineChart,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
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
  { to: "/trading", label: "Trading Terminal", icon: CandlestickChart },
  { to: "/scanner", label: "Opportunity Scanner", icon: Radar },
  { to: "/matrix", label: "Smart Matrix", icon: Grid3x3 },
  { to: "/signals", label: "Signals", icon: Radio },
  { to: "/performance", label: "Performance", icon: BarChart3 },
  { to: "/markets", label: "Markets", icon: LineChart },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/academy", label: "Academy", icon: BookOpen },
  { to: "/account", label: "Account", icon: Settings },
] as const;

const SIDEBAR_STORAGE_KEY = "cossa-signals-sidebar-collapsed";

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
  const [collapsed, setCollapsed] = useState(true);
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const isStaff = (roles ?? []).some((r) =>
    ["super_admin", "admin", "analyst", "support"].includes(r),
  );
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tradingWorkspace = pathname.startsWith("/trading");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved != null) setCollapsed(saved === "true");
    } catch {
      // Local storage is optional; compact mode remains the safe desktop default.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore browser storage restrictions.
      }
      return next;
    });
  }

  const nav = (mobile = false) => (
    <nav className={cn("flex flex-col gap-0.5", mobile ? "p-3" : collapsed ? "p-2" : "p-3")}>
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            title={!mobile && collapsed ? item.label : undefined}
            aria-label={item.label}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center rounded-md py-2 text-sm transition-colors",
              !mobile && collapsed ? "justify-center px-2" : "gap-2.5 px-3",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {mobile || !collapsed ? <span className="truncate">{item.label}</span> : null}
          </Link>
        );
      })}
      {isStaff ? (
        <>
          <div className={cn("my-2 h-px bg-sidebar-border", collapsed && !mobile ? "mx-1" : "mx-3")} />
          <Link
            to="/admin"
            title={!mobile && collapsed ? "Administration" : undefined}
            aria-label="Administration"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center rounded-md py-2 text-sm transition-colors",
              !mobile && collapsed ? "justify-center px-2" : "gap-2.5 px-3",
              pathname.startsWith("/admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
            )}
          >
            <Shield className="size-4 shrink-0" />
            {mobile || !collapsed ? <span>Administration</span> : null}
          </Link>
        </>
      ) : null}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <KillSwitchBanner />

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground lg:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <button
          type="button"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={toggleCollapsed}
          className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground lg:inline-flex"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
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
        <aside
          className={cn(
            "hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block",
            collapsed ? "w-16" : "w-56",
          )}
        >
          <div className="sticky top-14">{nav()}</div>
        </aside>

        {open ? (
          <div className="fixed inset-0 top-14 z-30 bg-background/80 lg:hidden">
            <div className="h-full w-64 overflow-y-auto border-r border-sidebar-border bg-sidebar">
              {nav(true)}
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">
          <div
            className={cn(
              tradingWorkspace
                ? "w-full px-2 py-2 sm:px-3 lg:px-4"
                : "mx-auto max-w-[1600px] px-4 py-6 sm:px-6",
            )}
          >
            {children}
          </div>
          {!tradingWorkspace ? (
            <footer className="mt-8 border-t border-border px-4 py-5 sm:px-6">
              <p className="mx-auto max-w-4xl text-[11px] leading-relaxed text-muted-foreground">
                {RISK_DISCLAIMER}
              </p>
            </footer>
          ) : null}
        </main>
      </div>
    </div>
  );
}
