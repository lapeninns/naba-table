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
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Guest profile harness
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Profile details</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Local-only proof for editable guest contact information.
          </p>
        </header>

        <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Editable
          </p>
          <h2 className="mt-2 text-xl font-semibold">Contact details</h2>
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
