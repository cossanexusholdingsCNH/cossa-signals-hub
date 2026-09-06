import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";

/** Redirects signed-out visitors to /auth and wraps signed-in pages in the desk shell. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading your desk…</p>
      </div>
    );
  }
  if (!user) return null;
  return <AppShell>{children}</AppShell>;
}
