import { Link } from "@tanstack/react-router";

import { CossaMark } from "@/components/layout/CossaMark";
import { RISK_DISCLAIMER } from "@/lib/cossa";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <CossaMark className="size-6" />
          <span className="text-sm font-semibold tracking-[0.18em] uppercase">
            Cossa <span className="text-primary">Signals</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-xs sm:gap-3 sm:text-sm">
          <Link to="/academy" className="px-2 py-1 text-muted-foreground hover:text-foreground">
            Academy
          </Link>
          <Link to="/pricing" className="px-2 py-1 text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link
            to="/auth"
            className="rounded-md border border-border-gold bg-gold-dim px-3 py-1.5 font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-panel">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <CossaMark className="size-5" />
          <span className="text-xs font-semibold tracking-[0.18em] uppercase">
            Cossa Signals
          </span>
          <span className="text-xs text-muted-foreground">
            Cossa Tech · Cossa Nexus Holdings (Pty) Ltd
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link to="/legal" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link to="/legal" className="hover:text-foreground">
            Risk Disclosure
          </Link>
          <Link to="/legal" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link to="/academy" className="hover:text-foreground">
            Academy
          </Link>
        </div>
        <p className="mt-5 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
          {RISK_DISCLAIMER}
        </p>
      </div>
    </footer>
  );
}
