import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicFooter, PublicNav } from "@/components/layout/PublicNav";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { useAcademyArticles, useAcademyCategories } from "@/hooks/useCossa";

export const Route = createFileRoute("/academy/")({
  head: () => ({
    meta: [
      { title: "Academy — Cossa Signals" },
      {
        name: "description",
        content:
          "Learn how to read signals properly: confidence, market regime, risk-reward, sample size and why rejecting a trade is often the right answer.",
      },
      { property: "og:title", content: "Academy — Cossa Signals" },
      {
        property: "og:description",
        content: "Trading education focused on evidence, risk and reading context — not hype.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcademyIndex,
});

function AcademyIndex() {
  const { data: categories } = useAcademyCategories();
  const { data: articles, isLoading, isError } = useAcademyArticles();

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Education"
          title="Cossa Signals Academy"
          description="A signal is only useful if you understand what it is claiming and how it could fail. These lessons cover confidence, regime, risk-reward, sample size and the discipline of standing aside."
        />

        {isError ? (
          <p className="py-10 text-center text-sm text-bearish">Unable to load the academy right now.</p>
        ) : isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading lessons…</p>
        ) : (articles ?? []).length === 0 ? (
          <Panel>
            <EmptyState
              title="No lessons published yet"
              description="Academy content appears here as soon as it is published."
            />
          </Panel>
        ) : (
          <div className="space-y-6">
            {(categories ?? []).map((cat) => {
              const items = (articles ?? []).filter((a) => a.category_id === cat.id);
              if (items.length === 0) return null;
              return (
                <Panel key={cat.id}>
                  <PanelHeader title={cat.name} {...(cat.description ? { subtitle: cat.description } : {})} />
                  <ul className="divide-y divide-border/60">
                    {items.map((a) => (
                      <li key={a.id}>
                        <Link
                          to="/academy/$slug"
                          params={{ slug: a.slug }}
                          className="block px-4 py-3 transition-colors hover:bg-card/60"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-medium">{a.title}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {a.level ? `${a.level} · ` : ""}
                              {a.reading_minutes ? `${a.reading_minutes} min read` : ""}
                            </span>
                          </div>
                          {a.summary ? (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {a.summary}
                            </p>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              );
            })}

            {(() => {
              const uncategorised = (articles ?? []).filter(
                (a) => !(categories ?? []).some((c) => c.id === a.category_id),
              );
              if (uncategorised.length === 0) return null;
              return (
                <Panel>
                  <PanelHeader title="More lessons" />
                  <ul className="divide-y divide-border/60">
                    {uncategorised.map((a) => (
                      <li key={a.id}>
                        <Link
                          to="/academy/$slug"
                          params={{ slug: a.slug }}
                          className="block px-4 py-3 text-sm hover:bg-card/60"
                        >
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              );
            })()}
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
