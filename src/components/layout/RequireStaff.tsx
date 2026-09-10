import { EmptyState } from "@/components/cossa/primitives";
import { useAuth, useRoles } from "@/hooks/useAuth";

const STAFF = ["super_admin", "admin", "analyst", "support"];

/** Renders children only for staff roles. Read access is still enforced by the database. */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: roles, isLoading } = useRoles(user?.id);

  if (isLoading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Checking permissions…</p>;
  }
  const isStaff = (roles ?? []).some((r) => STAFF.includes(r));
  if (!isStaff) {
    return (
      <EmptyState
        title="Administration is restricted"
        description="Your account does not have staff permissions. If you believe this is wrong, contact Cossa Tech."
      />
    );
  }
  return <>{children}</>;
}

export function useIsAdmin() {
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  return (roles ?? []).some((r) => r === "super_admin" || r === "admin");
}
