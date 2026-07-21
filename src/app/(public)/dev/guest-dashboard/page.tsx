import { Heading, Text } from '@/components/ui/typography';

import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Guest dashboard',
};

export default function GuestDashboardDevPage() {
  enforceDevOnly();

  return (
    <main className="guest-theme min-h-dvh bg-background px-4 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-2 border-b border-border pb-5">
          <Text variant="eyebrow">
            Guest dashboard harness
          </Text>
          <Heading variant="section" as="h1">
            Your bookings
          </Heading>
          <Text variant="caption" className="max-w-2xl">
            Local-only proof for dashboard booking summaries, quick links, and the current
            reservation panel.
          </Text>
        </header>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Text variant="eyebrow">
              Current reservation
            </Text>
            <Heading variant="card" as="h2" className="mt-2">
              White Horse
            </Heading>
            <Text variant="caption" className="mt-2">
              2 guests, dinner service, receipt and manage actions available.
            </Text>
          </article>

          <aside className="rounded-xl border border-border bg-muted/30 p-5">
            <h2 className="text-base font-semibold">Profile details</h2>
            <Text variant="caption" className="mt-2">
              Contact details and receipts stay available from the dashboard.
            </Text>
          </aside>
        </div>
      </section>
    </main>
  );
}
