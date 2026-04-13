import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { BookingMessageShell } from '@/components/features/booking/ui/BookingComponents';
import { Button } from '@/components/ui/button';

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
    <BookingMessageShell
      icon={AlertTriangle}
      title={content.title}
      description={content.description}
      tone="warning"
      actions={
        <>
          <Button asChild size="lg" className="w-full rounded-full sm:w-auto">
            <Link href="/auth/signin">Sign in</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full rounded-full sm:w-auto">
            <Link href="/">Return home</Link>
          </Button>
        </>
      }
    />
  );
}
