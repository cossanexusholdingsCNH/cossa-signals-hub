import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, Panel, PanelHeader, StatCard } from "@/components/cossa/primitives";
import { useIsAdmin } from "@/components/layout/RequireStaff";
import {
  useAllSignals,
  useAuditLogs,
  useDataHealth,
  useHeartbeats,
  useInstruments,
  usePlatformControls,
  useUpdatePlatformControls,
} from "@/hooks/useCossa";
import { formatDate, relativeAge } from "@/lib/cossa";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Administration — Cossa Signals" },
      {
        name: "description",
        content: "Staff overview of Cossa Signals platform controls, coverage, pipeline health and recent activity.",
      },
      { property: "og:title", content: "Administration — Cossa Signals" },
      { property: "og:description", content: "Platform controls and operational overview." },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const isAdmin = useIsAdmin();
  const { data: controls } = usePlatformControls();
  const { data: signals } = useAllSignals(300);
  const { data: instruments } = useInstruments();
  const { data: health } = useDataHealth();
  const { data: beats } = useHeartbeats();
  const { data: logs } = useAuditLogs(10);
  const update = useUpdatePlatformControls();

  const liveSignals = (signals ?? []).filter((s) => !s.is_demo);
  const demoSignals = (signals ?? []).filter((s) => s.is_demo);
  const degraded = (health ?? []).filter((h) => h.status === "stale" || h.status === "offline");
  const offlineServices = (beats ?? []).filter((b) => b.status !== "healthy");

  const toggle = (patch: Parameters<typeof update.mutate>[0]["patch"]) => {
    if (!controls) return;
    update.mutate({ id: controls.id, patch });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Platform control"
        description="Operational state of the Cossa Signals platform. Controls here affect every user immediately."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Signal delivery"
          value={controls?.signals_enabled ? "Enabled" : "Paused"}
          tone={controls?.signals_enabled ? "bullish" : "bearish"}
        />
        <StatCard
          label="Maintenance mode"
          value={controls?.maintenance_mode ? "On" : "Off"}
          tone={controls?.maintenance_mode ? "caution" : "bullish"}
        />
        <StatCard label="Live signals" value={liveSignals.length} hint={`${demoSignals.length} demo rows`} />
        <StatCard
          label="Degraded feeds"
          value={degraded.length}
          tone={degraded.length === 0 ? "bullish" : "bearish"}
        />
      </div>

      <Panel gold>
        <PanelHeader
          title="Global controls"
          subtitle={
            isAdmin
              ? "Changes apply platform-wide, immediately"
              : "Read-only — admin role required to change these"
          }
        />
        <div className="space-y-3 px-4 py-4">
          <ControlRow
            label="Signal delivery enabled"
            hint="Kill switch. When off, users see a controlled paused state and historical records only."
            checked={Boolean(controls?.signals_enabled)}
            disabled={!isAdmin || update.isPending}
            onChange={(v) => toggle({ signals_enabled: v })}
          />
          <ControlRow
            label="Alert delivery enabled"
            hint="Suspends outbound alerts without touching signal publication."
            checked={Boolean(controls?.alerts_enabled)}
            disabled={!isAdmin || update.isPending}
            onChange={(v) => toggle({ alerts_enabled: v })}
          />
          <ControlRow
            label="Maintenance mode"
            hint="Displays a maintenance banner across the platform."
            checked={Boolean(controls?.maintenance_mode)}
            disabled={!isAdmin || update.isPending}
            onChange={(v) => toggle({ maintenance_mode: v })}
          />
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <p className="text-[11px] text-muted-foreground">
              Stale threshold: <span className="numeric">{controls?.stale_threshold_seconds ?? "—"}s</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Minimum reliable sample: <span className="numeric">{controls?.minimum_sample_size ?? "—"}</span> trades
            </p>
          </div>
          {update.isError ? (
            <p className="text-xs text-bearish">Unable to update platform controls.</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Last updated {formatDate(controls?.updated_at)}
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Coverage" subtitle="Instruments registered by the engine" />
          <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs">
            <p>
              Total: <span className="numeric font-semibold">{(instruments ?? []).length}</span>
            </p>
            <p>
              Enabled:{" "}
              <span className="numeric font-semibold">
                {(instruments ?? []).filter((i) => i.enabled).length}
              </span>
            </p>
            <p>
              Demo rows:{" "}
              <span className="numeric font-semibold text-caution">
                {(instruments ?? []).filter((i) => i.is_demo).length}
              </span>
            </p>
            <p>
              Services degraded:{" "}
              <span className="numeric font-semibold">{offlineServices.length}</span>
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Recent activity" subtitle="Latest audit entries" />
          {(logs ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {(logs ?? []).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                  <span>
                    <span className="font-medium">{l.action}</span>
                    <span className="ml-2 text-muted-foreground">{l.entity}</span>
                  </span>
                  <span className="text-muted-foreground">{relativeAge(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ControlRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-0">
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${
          checked ? "border-border-gold bg-primary" : "border-border bg-surface"
        }`}
      >
        <span
          className={`absolute top-0.5 size-3.5 rounded-full transition-all ${
            checked ? "left-[18px] bg-primary-foreground" : "left-0.5 bg-muted-foreground"
          }`}
        />
      </button>
    </div>
  );
}
