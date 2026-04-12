import { AlertTriangle, ShieldCheck } from 'lucide-react';

import { BookingStatePage } from '@/components/features/booking/ui/BookingStatePage';

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
    <BookingStatePage
      eyebrow="Booking link issue"
      title={content.title}
      description={content.description}
      icon={AlertTriangle}
      tone={code === 'ACCESS_TOKEN_NOT_CONFIGURED' ? 'warning' : 'danger'}
      primaryAction={{ href: '/auth/signin', label: 'Sign in to manage' }}
      secondaryAction={{ href: '/', label: 'Return home', variant: 'secondary' }}
      aside={
        <>
          <div className="space-y-2">
            <p className="luminous-kicker">Recovery guidance</p>
            <p className="text-sm font-semibold text-foreground">Use the freshest route back in.</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Old or incomplete links can no longer guarantee access. Signing in or using the most
              recent booking email is the safest path.
            </p>
          </div>
          <div className="luminous-card-soft rounded-[var(--luminous-radius)] px-4 py-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Access stays protected</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Booking recovery still respects the same guest authentication and token rules.
                </p>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
}
