import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { useAuditLogs } from "@/hooks/useCossa";
import { formatDate } from "@/lib/cossa";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — Cossa Signals" },
      {
        name: "description",
        content: "Immutable record of platform actions: who changed what, on which entity, and when.",
      },
      { property: "og:title", content: "Audit Log — Cossa Signals" },
      { property: "og:description", content: "Immutable record of platform actions." },
    ],
  }),
  component: AdminAudit,
});

function AdminAudit() {
  const { data: logs, isLoading, isError } = useAuditLogs(300);
  const [entity, setEntity] = useState("all");

  const entities = useMemo(
    () => [...new Set((logs ?? []).map((l) => l.entity))].sort(),
    [logs],
  );
  const rows = (logs ?? []).filter((l) => entity === "all" || l.entity === entity);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Append-only. Entries cannot be edited or deleted, including by staff — that is what makes the record worth keeping."
      />

      <Panel>
        <PanelHeader
          title="Recorded actions"
          subtitle={`${rows.length} entries`}
          action={
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-border-gold"
            >
              <option value="all">All entities</option>
              {entities.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          }
        />
        {isError ? (
          <p className="px-4 py-10 text-center text-sm text-bearish">Unable to load the audit log.</p>
        ) : isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading entries…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No audit entries yet"
            description="Entries appear as staff and backend services act on platform data."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["When", "Actor", "Action", "Entity", "Entity ID"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(l.created_at)}
                    </td>
                    <td className="px-3 py-2.5">{l.actor_label ?? "system"}</td>
                    <td className="px-3 py-2.5 font-medium">{l.action}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.entity}</td>
                    <td className="numeric max-w-[220px] truncate px-3 py-2.5 text-muted-foreground">
                      {l.entity_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
