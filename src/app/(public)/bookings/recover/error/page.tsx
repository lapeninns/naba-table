import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@shared/ui/button';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Booking Link Issue · Nab a Table',
  description: "We couldn't verify your booking link.",
};

type SearchParams = Promise<{ code?: string; reason?: string }>;

const copyByCode: Record<string, { title: string; description: string }> = {
  MISSING_ACCESS_TOKEN: {
    title: 'Link is incomplete',
    description:
      'This booking link is missing recovery information. Please use the latest link from your email.',
  },
  ACCESS_TOKEN_NOT_CONFIGURED: {
    title: 'Booking recovery unavailable',
    description:
      'Booking recovery links are not currently enabled. Please contact support or try signing in.',
  },
  INVALID_ACCESS_TOKEN: {
    title: 'Link is not valid',
    description:
      "This booking link can't be verified. Please request a new link or sign in to manage your booking.",
  },
  ACCESS_TOKEN_EXPIRED: {
    title: 'Link has expired',
    description:
      'This booking link has expired. Please request a new link or sign in to manage your booking.',
  },
  LEGACY_TOKEN_DEPRECATED: {
    title: 'Link is outdated',
    description:
      'This booking link is no longer supported. Please use the latest link from your email or sign in to manage your booking.',
  },
};

export default async function BookingRecoverErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = (await searchParams) ?? {};
  const code = resolved.code ?? 'INVALID_ACCESS_TOKEN';
  const content = copyByCode[code] ?? copyByCode.INVALID_ACCESS_TOKEN;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{content.title}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{content.description}</p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href="/auth/signin">Sign in</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Return home</Link>
        </Button>
      </div>
    </main>
  );
}
