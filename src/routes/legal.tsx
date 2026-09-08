import { createFileRoute } from "@tanstack/react-router";

import { PublicFooter, PublicNav } from "@/components/layout/PublicNav";
import { PageHeader, Panel, PanelHeader } from "@/components/cossa/primitives";
import { RISK_DISCLAIMER } from "@/lib/cossa";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal & Risk Disclosure — Cossa Signals" },
      {
        name: "description",
        content:
          "Terms of service, risk disclosure and privacy policy for Cossa Signals, a division of Cossa Tech under Cossa Nexus Holdings (Pty) Ltd.",
      },
      { property: "og:title", content: "Legal & Risk Disclosure — Cossa Signals" },
      { property: "og:description", content: "Terms, risk disclosure and privacy policy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Legal"
          title="Terms, risk disclosure & privacy"
          description="Cossa Signals is operated by Cossa Tech, a division of Cossa Nexus Holdings (Pty) Ltd."
        />

        <div className="space-y-4">
          <Panel id="risk">
            <PanelHeader title="Risk disclosure" />
            <div className="space-y-3 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              <p>{RISK_DISCLAIMER}</p>
              <p>
                Trading leveraged instruments and synthetic indices carries a high level of risk and can
                result in the loss of all deposited funds. Past performance, backtested results and paper
                trading records are not indicative of future results.
              </p>
              <p>
                Cossa Signals publishes market intelligence and analysis. It does not execute orders, hold
                client funds, or provide personal financial advice. Every decision to enter or exit a
                position is yours alone.
              </p>
            </div>
          </Panel>

          <Panel id="terms">
            <PanelHeader title="Terms of service" />
            <div className="space-y-3 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                By creating an account you agree to use the platform for personal research and
                decision-support only. You may not resell, redistribute or systematically extract
                platform output without written permission.
              </p>
              <p>
                Access levels are enforced by our database. Attempting to bypass access controls,
                rate limits or security measures terminates your account.
              </p>
              <p>
                Signals may be paused at any time by our risk controls. Historical records remain
                visible during such pauses.
              </p>
              <p>
                Subscriptions renew monthly until cancelled. Cancellation takes effect at the end of the
                current billing period.
              </p>
            </div>
          </Panel>

          <Panel id="privacy">
            <PanelHeader title="Privacy policy" />
            <div className="space-y-3 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                We store the account details you give us — email address, name, country, contact handles
                for alerts — plus your watchlists, alert preferences and subscription state.
              </p>
              <p>
                Your data is protected by row-level security: your records are readable only by you and,
                where strictly necessary for support, by authorised staff.
              </p>
              <p>
                We do not sell personal data. Payment card details are handled by our payment provider and
                never touch our servers.
              </p>
              <p>
                You may request deletion of your account and personal data at any time from your account
                page or by contacting Cossa Tech.
              </p>
            </div>
          </Panel>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
