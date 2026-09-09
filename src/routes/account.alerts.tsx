import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { useAuth } from "@/hooks/useAuth";
import {
  usePlatformControls,
  useAlertPreferences,
  useUpdateAlertPreferences,
  type AlertPrefs,
} from "@/hooks/useCossa";

export const Route = createFileRoute("/account/alerts")({
  head: () => ({
    meta: [
      { title: "Alert Preferences — Cossa Signals" },
      {
        name: "description",
        content: "Choose which Cossa Signals events reach you and on which channels — in-app, email, Telegram, WhatsApp or push.",
      },
      { property: "og:title", content: "Alert Preferences — Cossa Signals" },
      { property: "og:description", content: "Control which signal events reach you and where." },
    ],
  }),
  component: AlertsPage,
});

const EVENTS: { key: keyof AlertPrefs; label: string; hint: string }[] = [
  { key: "new_signal", label: "New signal published", hint: "Any qualified output, including WAIT" },
  { key: "high_confidence_signal", label: "High-confidence signal", hint: "Strong or exceptional quality only" },
  { key: "signal_invalidated", label: "Signal invalidated", hint: "Setup no longer valid" },
  { key: "target_hit", label: "Target hit", hint: "TP1, TP2 or TP3 reached" },
  { key: "stop_loss_hit", label: "Stop loss hit", hint: "Protective stop reached" },
  { key: "instrument_becomes_active", label: "Instrument becomes active", hint: "A watched market wakes up" },
  { key: "regime_change", label: "Market regime change", hint: "Conditions shift on a watched instrument" },
];

const CHANNELS: { key: keyof AlertPrefs; label: string }[] = [
  { key: "channel_in_app", label: "In-app" },
  { key: "channel_email", label: "Email" },
  { key: "channel_telegram", label: "Telegram" },
  { key: "channel_whatsapp", label: "WhatsApp" },
  { key: "channel_push", label: "Push" },
];

function AlertsPage() {
  const { user } = useAuth();
  const { data: prefs, isLoading, isError } = useAlertPreferences(user?.id);
  const update = useUpdateAlertPreferences(user?.id);
  const { data: controls } = usePlatformControls();

  const setBool = (key: keyof AlertPrefs, value: boolean) =>
    update.mutate({ [key]: value } as Partial<AlertPrefs>);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Notifications"
        title="Alert preferences"
        description="Alerts are dispatched by the Cossa Signals backend. Choose the events worth interrupting you for and where they should land."
      />

      {controls && !controls.alerts_enabled ? (
        <Panel>
          <p className="px-4 py-3 text-xs text-caution">
            Alert delivery is currently paused platform-wide. Your preferences are saved and will apply
            when delivery resumes.
          </p>
        </Panel>
      ) : null}

      {isError ? (
        <p className="py-10 text-center text-sm text-bearish">Unable to load your alert preferences.</p>
      ) : isLoading || !prefs ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading preferences…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Events" subtitle="What should trigger an alert" />
            <ul className="divide-y divide-border/60">
              {EVENTS.map((e) => (
                <li key={String(e.key)} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium">{e.label}</p>
                    <p className="text-[11px] text-muted-foreground">{e.hint}</p>
                  </div>
                  <Toggle
                    checked={Boolean(prefs[e.key])}
                    onChange={(v) => setBool(e.key, v)}
                    label={e.label}
                  />
                </li>
              ))}
            </ul>
          </Panel>

          <div className="space-y-4">
            <Panel>
              <PanelHeader title="Channels" subtitle="Where alerts are delivered" />
              <ul className="divide-y divide-border/60">
                {CHANNELS.map((c) => (
                  <li key={String(c.key)} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-xs font-medium">{c.label}</span>
                    <Toggle
                      checked={Boolean(prefs[c.key])}
                      onChange={(v) => setBool(c.key, v)}
                      label={c.label}
                    />
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelHeader title="Contact handles" subtitle="Needed for Telegram and WhatsApp" />
              <div className="space-y-3 px-4 py-4">
                <HandleField
                  label="Telegram handle"
                  defaultValue={prefs.telegram_handle ?? ""}
                  onSave={(v) => update.mutate({ telegram_handle: v || null })}
                />
                <HandleField
                  label="WhatsApp number"
                  defaultValue={prefs.whatsapp_number ?? ""}
                  onSave={(v) => update.mutate({ whatsapp_number: v || null })}
                />
                {update.isError ? (
                  <p className="text-xs text-bearish">Unable to save preferences.</p>
                ) : null}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
        checked ? "border-border-gold bg-primary" : "border-border bg-surface"
      }`}
    >
      <span
        className={`absolute top-0.5 size-3.5 rounded-full transition-all ${
          checked ? "left-[18px] bg-primary-foreground" : "left-0.5 bg-muted-foreground"
        }`}
      />
    </button>
  );
}

function HandleField({
  label,
  defaultValue,
  onSave,
}: {
  label: string;
  defaultValue: string;
  onSave: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        defaultValue={defaultValue}
        onBlur={(e) => {
          if (e.target.value !== defaultValue) onSave(e.target.value.trim());
        }}
        className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-border-gold"
      />
      <span className="mt-1 block text-[11px] text-muted-foreground">Saved when you click away.</span>
    </label>
  );
}
