import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Panel, PanelHeader } from "@/components/cossa/primitives";
import { useIsAdmin } from "@/components/layout/RequireStaff";
import { supabase } from "@/integrations/supabase/client";
import type { ScannerSettings } from "@/lib/opportunity-scanner";

type ScannerSettingsResponse = {
  ok?: boolean;
  error?: string;
  settings?: ScannerSettings;
};

async function authToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Authentication required");
  return token;
}

export function ScannerControlsPanel() {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["opportunity-scanner", "settings"],
    queryFn: async () => {
      const token = await authToken();
      const response = await fetch("/api/opportunity-scanner", {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as ScannerSettingsResponse;
      if (!response.ok || !payload.ok || !payload.settings)
        throw new Error(payload.error ?? "Unable to load scanner settings");
      return payload.settings;
    },
  });

  const [draft, setDraft] = useState<ScannerSettings | null>(null);
  useEffect(() => {
    if (settingsQuery.data) setDraft(settingsQuery.data);
  }, [settingsQuery.data]);

  const weightTotal = useMemo(() => {
    if (!draft) return 0;
    return Object.values(draft.weights).reduce((sum, value) => sum + Number(value), 0);
  }, [draft]);

  const save = useMutation({
    mutationFn: async (settings: ScannerSettings) => {
      const token = await authToken();
      const response = await fetch("/api/opportunity-scanner", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ settings }),
      });
      const payload = (await response.json()) as ScannerSettingsResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Unable to save scanner settings");
      return payload.settings;
    },
    onSuccess: (settings) => {
      if (settings) setDraft(settings);
      void queryClient.invalidateQueries({ queryKey: ["opportunity-scanner"] });
    },
  });

  if (!draft) {
    return (
      <Panel>
        <PanelHeader title="Opportunity Scanner controls" subtitle="Loading deterministic ranking configuration…" />
      </Panel>
    );
  }

  const updateWeight = (key: keyof ScannerSettings["weights"], value: number) => {
    setDraft((current) =>
      current
        ? { ...current, weights: { ...current.weights, [key]: value } }
        : current,
    );
  };

  const canSave =
    isAdmin &&
    !save.isPending &&
    Math.abs(weightTotal - 1) <= 0.0001 &&
    draft.minSignalConfidence >= 0 &&
    draft.minSignalConfidence <= 100 &&
    draft.minDataConfidence >= 0 &&
    draft.minDataConfidence <= 100 &&
    draft.minRiskReward > 0 &&
    draft.maxCandidateAgeMinutes >= 1;

  return (
    <Panel gold>
      <PanelHeader
        title="Opportunity Scanner controls"
        subtitle="Qualification gates and ranking weights. Changes apply to the next scanner refresh."
      />
      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            label="Minimum Signal Confidence"
            value={draft.minSignalConfidence}
            min={0}
            max={100}
            step={1}
            disabled={!isAdmin}
            onChange={(value) => setDraft({ ...draft, minSignalConfidence: value })}
          />
          <NumberField
            label="Minimum Data Confidence"
            value={draft.minDataConfidence}
            min={0}
            max={100}
            step={1}
            disabled={!isAdmin}
            onChange={(value) => setDraft({ ...draft, minDataConfidence: value })}
          />
          <NumberField
            label="Minimum R:R"
            value={draft.minRiskReward}
            min={0.1}
            max={20}
            step={0.1}
            disabled={!isAdmin}
            onChange={(value) => setDraft({ ...draft, minRiskReward: value })}
          />
          <NumberField
            label="Max evidence age (minutes)"
            value={draft.maxCandidateAgeMinutes}
            min={1}
            max={10080}
            step={1}
            disabled={!isAdmin}
            onChange={(value) => setDraft({ ...draft, maxCandidateAgeMinutes: value })}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium">Ranking weights</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <NumberField label="Signal" value={draft.weights.signal} min={0} max={1} step={0.05} disabled={!isAdmin} onChange={(value) => updateWeight("signal", value)} />
            <NumberField label="Data" value={draft.weights.data} min={0} max={1} step={0.05} disabled={!isAdmin} onChange={(value) => updateWeight("data", value)} />
            <NumberField label="R:R" value={draft.weights.riskReward} min={0} max={1} step={0.05} disabled={!isAdmin} onChange={(value) => updateWeight("riskReward", value)} />
            <NumberField label="Structure" value={draft.weights.structure} min={0} max={1} step={0.05} disabled={!isAdmin} onChange={(value) => updateWeight("structure", value)} />
            <NumberField label="Regime" value={draft.weights.regime} min={0} max={1} step={0.05} disabled={!isAdmin} onChange={(value) => updateWeight("regime", value)} />
          </div>
          <p className={`mt-2 text-[11px] ${Math.abs(weightTotal - 1) <= 0.0001 ? "text-muted-foreground" : "text-bearish"}`}>
            Weight total: {(weightTotal * 100).toFixed(1)}% — must equal 100%.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => save.mutate(draft)}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {save.isPending ? "Saving…" : "Save scanner controls"}
          </button>
          {!isAdmin ? <span className="text-[11px] text-muted-foreground">Read-only — administrator role required.</span> : null}
          {save.isSuccess ? <span className="text-[11px] text-bullish">Saved and active.</span> : null}
          {save.isError ? <span className="text-[11px] text-bearish">{save.error instanceof Error ? save.error.message : "Save failed"}</span> : null}
        </div>
      </div>
    </Panel>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-[11px] text-muted-foreground">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-md border bg-background px-2.5 py-2 text-sm text-foreground disabled:opacity-60"
      />
    </label>
  );
}
