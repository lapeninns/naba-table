import { Heading, Text } from '@/components/ui/typography';

import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Guest receipt',
};

export default function GuestReceiptDevPage() {
  enforceDevOnly();

  return (
    <main className="guest-theme min-h-dvh bg-background px-4 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-2 border-b border-border pb-5">
          <Text variant="eyebrow">Booking receipt harness</Text>
          <Heading variant="section" as="h1">
            Radix Luma Dining Room
          </Heading>
          <Text variant="body" className="max-w-2xl">
            Local-only proof for the guest receipt shell.
          </Text>
        </header>

        <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Text variant="eyebrow">Reservation reference</Text>
          <p className="mt-2 font-mono text-2xl font-bold">NB5678</p>
          <Text variant="body" className="mt-2">
            Keep this receipt available for check-in and arrival details.
          </Text>
        </article>
      </section>
    </main>
  );
}
