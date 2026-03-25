import { headers } from 'next/headers';
import Link from 'next/link';

import {
  computeDevAuthValidationResult,
  resolveDevAuthFixtureRole,
  resolveDevAuthFixtureScenario,
} from '@/lib/auth/dev-auth-validation';
import { enforceDevOnly } from '@/src/app/(public)/dev/_shared/enforceDevOnly';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export default async function DevAuthValidationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  enforceDevOnly();

  const resolvedSearchParams = await searchParams;
  const headersList = await headers();
  const hostHeader = headersList.get('host') ?? 'localhost:3000';
  const hostname = hostHeader.replace(/:\d+$/, '');
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';

  const role = resolveDevAuthFixtureRole(resolvedSearchParams.role);
  const scenario = resolveDevAuthFixtureScenario(resolvedSearchParams.scenario);
  const redirectedFrom = firstValue(resolvedSearchParams.redirectedFrom);

  const result = computeDevAuthValidationResult({
    role,
    scenario,
    redirectedFrom,
    hostname,
    rootDomain,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-3">
        <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Dev-only auth validation harness
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Authenticated redirect fixture
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This local-only harness mirrors the canonical guest/auth redirect rules without mutating
          shared auth state. Use it to validate authenticated guest and owner redirect outcomes.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <FixtureField label="Scenario" value={result.scenario} />
          <FixtureField label="Role" value={result.role} />
          <FixtureField label="Host" value={result.hostname} />
          <FixtureField label="Root domain" value={result.rootDomain} />
          <FixtureField label="Input redirectedFrom" value={result.inputRedirectedFrom ?? '—'} />
          <FixtureField
            label="Sanitized redirectedFrom"
            value={result.sanitizedRedirectedFrom ?? 'fallback default'}
          />
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Final destination
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">{result.finalDestination}</p>
        </div>

        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Suggested validation links</h2>
        <div className="flex flex-col gap-2 text-sm">
          <FixtureLink
            href="/dev/auth-validation?scenario=home&role=guest"
            label="Authenticated guest entering /"
          />
          <FixtureLink
            href="/dev/auth-validation?scenario=signin&role=guest&redirectedFrom=/bookings"
            label="Guest sign-in return to safe guest/public intent"
          />
          <FixtureLink
            href="/dev/auth-validation?scenario=signin&role=owner&redirectedFrom=/app/dashboard"
            label="Owner sign-in return to app intent"
          />
          <FixtureLink
            href="/dev/auth-validation?scenario=auth&role=guest"
            label="Authenticated guest visiting /auth"
          />
          <FixtureLink
            href="/dev/auth-validation?scenario=auth&role=owner"
            label="Authenticated owner visiting /auth"
          />
        </div>
      </section>
    </main>
  );
}

function FixtureField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function FixtureLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="text-primary underline-offset-4 hover:underline" href={href}>
      {label}
    </Link>
  );
}
