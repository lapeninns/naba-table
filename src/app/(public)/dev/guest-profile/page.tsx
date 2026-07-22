import { Heading, Text } from '@/components/ui/typography';

import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Guest profile',
};

export default function GuestProfileDevPage() {
  enforceDevOnly();

  return (
    <main className="guest-theme min-h-dvh bg-background px-4 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-2 border-b border-border pb-5">
          <Text variant="eyebrow">Guest profile harness</Text>
          <Heading variant="section" as="h1">
            Profile details
          </Heading>
          <Text variant="caption" className="max-w-2xl">
            Local-only proof for editable guest contact information.
          </Text>
        </header>

        <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Text variant="eyebrow">Editable</Text>
          <Heading variant="card" as="h2" className="mt-2">
            Contact details
          </Heading>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Full name</dt>
              <dd className="font-medium">Guest Booker</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email address</dt>
              <dd className="font-medium">guest@example.com</dd>
            </div>
          </dl>
        </article>
      </section>
    </main>
  );
}
