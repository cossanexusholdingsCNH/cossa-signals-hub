import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DataRow, PageHeader, Panel, PanelHeader, RiskDisclaimer } from "@/components/cossa/primitives";
import { useAuth, useProfile, useRoles } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/cossa";

export const Route = createFileRoute("/account/")({
  head: () => ({
    meta: [
      { title: "Account — Cossa Signals" },
      {
        name: "description",
        content: "Manage your Cossa Signals profile, contact details and platform preferences.",
      },
      { property: "og:title", content: "Account — Cossa Signals" },
      { property: "og:description", content: "Your Cossa Signals profile and preferences." },
    ],
  }),
  component: AccountProfile,
});

function AccountProfile() {
  const { user } = useAuth();
  const { data: profile, isLoading, isError } = useProfile(user?.id);
  const { data: roles } = useRoles(user?.id);
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setCountry(profile.country ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, country })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Details used for alerts, billing records and support. Only you and authorised staff can see them."
      />

      {isError ? (
        <p className="py-10 text-center text-sm text-bearish">Unable to load your profile.</p>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading profile…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Personal details" subtitle="Update and save" />
            <div className="space-y-3 px-4 py-4">
              <Field label="Email" value={user?.email ?? ""} disabled />
              <Field label="Full name" value={fullName} onChange={setFullName} />
              <Field label="Phone" value={phone} onChange={setPhone} />
              <Field label="Country" value={country} onChange={setCountry} />
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                  className="rounded-md border border-border-gold bg-gold-dim px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
                >
                  {save.isPending ? "Saving…" : "Save changes"}
                </button>
                {save.isSuccess ? <span className="text-xs text-bullish">Saved.</span> : null}
                {save.isError ? (
                  <span className="text-xs text-bearish">Unable to save changes.</span>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Account status" subtitle="Read-only, managed by the platform" />
            <div className="px-4 py-2">
              <DataRow label="Plan" value={profile?.subscription_tier ?? "free"} />
              <DataRow label="Subscription status" value={profile?.subscription_status ?? "—"} />
              <DataRow label="Preferred currency" value={profile?.preferred_currency ?? "ZAR"} />
              <DataRow
                label="Risk disclosure accepted"
                value={profile?.risk_disclosure_accepted ? "Yes" : "Not yet"}
              />
              <DataRow label="Terms accepted" value={formatDate(profile?.terms_accepted_at)} />
              <DataRow label="Roles" value={(roles ?? ["user"]).join(", ")} />
              <DataRow label="Member since" value={formatDate(profile?.created_at)} />
            </div>
          </Panel>
        </div>
      )}

      <Panel className="px-4 py-4">
        <RiskDisclaimer />
      </Panel>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-border-gold disabled:text-muted-foreground"
      />
    </label>
  );
}
