import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicFooter, PublicNav } from "@/components/layout/PublicNav";
import { EmptyState, Panel, RiskDisclaimer } from "@/components/cossa/primitives";
import { useAcademyArticle } from "@/hooks/useCossa";
import { formatDate } from "@/lib/cossa";

export const Route = createFileRoute("/academy/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Cossa Signals Academy` },
      {
        name: "description",
        content:
          "A Cossa Signals Academy lesson on reading signals with evidence, risk awareness and market context.",
      },
      { property: "og:title", content: "Cossa Signals Academy" },
      {
        property: "og:description",
        content: "Evidence-based trading education from Cossa Signals.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data: article, isLoading, isError } = useAcademyArticle(slug);

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/academy" className="text-xs text-primary hover:underline">
          ← Back to Academy
        </Link>

        {isError ? (
          <p className="py-16 text-center text-sm text-bearish">Unable to load this lesson.</p>
        ) : isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading lesson…</p>
        ) : !article ? (
          <Panel className="mt-6">
            <EmptyState
              title="Lesson not found"
              description="This lesson may have been unpublished or the link is incorrect."
            />
          </Panel>
        ) : (
          <article className="mt-5">
            <p className="eyebrow">
              {article.level ?? "Lesson"}
              {article.reading_minutes ? ` · ${article.reading_minutes} min read` : ""}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {article.title}
            </h1>
            {article.summary ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{article.summary}</p>
            ) : null}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Published {formatDate(article.created_at)}
            </p>
            <div className="gold-rule my-6" />
            {article.content ? (
              <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
                {article.content.split(/\n{2,}/).map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The full text of this lesson has not been published yet.
              </p>
            )}
            <div className="mt-10 border-t border-border pt-5">
              <RiskDisclaimer />
            </div>
          </article>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
