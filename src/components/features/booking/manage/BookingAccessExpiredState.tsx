import { KeyRound, LinkIcon, ShieldCheck } from 'lucide-react';

import {
  GuestHero,
  GuestPageFrame,
  GuestPanel,
  GuestPrimaryButton,
  GuestSecondaryButton,
} from '@/components/guest/ui/GuestPageShell';

import type { BookingAccessDeniedReason } from '@/server/bookings/guest-booking-page-gate';

const COPY: Record<BookingAccessDeniedReason, { title: string; description: string }> = {
  expired: {
    title: 'This booking link has expired',
    description:
      'For your security, booking links stop working after a while. Your booking itself is unchanged.',
  },
  revoked: {
    title: 'This booking link is no longer valid',
    description:
      'The contact details on this booking changed after the link was sent, so older links stopped working.',
  },
  invalid: {
    title: 'This booking link could not be verified',
    description: 'The link is incomplete or belongs to a different booking.',
  },
  not_found: {
    title: 'We couldn’t open this booking',
    description:
      'It isn’t linked to your account. Open the link from your booking email, or request a new one.',
  },
  not_configured: {
    title: 'Booking links are temporarily unavailable',
    description: 'Please try again later, or contact the venue.',
  },
};

/**
 * The "link expired / no longer valid" state for guest manage and receipt
 * pages (design §6.5). The primary action requests a fresh link.
 */
export function BookingAccessExpiredState({
  reason,
  isAuthenticated,
}: {
  reason: BookingAccessDeniedReason;
  isAuthenticated: boolean;
}) {
  const copy = COPY[reason];
  return (
    <GuestPageFrame>
      <GuestHero
        compact
        eyebrow="Manage booking"
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <GuestPrimaryButton href="/bookings/find">Email me a new link</GuestPrimaryButton>
            <GuestSecondaryButton href={isAuthenticated ? '/guest/bookings' : '/auth/signin'}>
              {isAuthenticated ? 'My bookings' : 'Sign in'}
            </GuestSecondaryButton>
          </>
        }
        meta={
          <>
            <span className="pg-chip pg-danger-badge">
              <LinkIcon className="size-3.5" aria-hidden />
              Link not opened
            </span>
            <span className="pg-chip">
              <ShieldCheck className="size-3.5" aria-hidden />
              Booking protected
            </span>
          </>
        }
        aside={
          <GuestPanel className="p-5 sm:p-6" data-testid="booking-access-expired">
            <div className="flex items-start gap-4">
              <span className="pg-danger-icon flex size-12 shrink-0 items-center justify-center rounded-full">
                <KeyRound className="size-5" aria-hidden />
              </span>
              <div>
                <p className="pg-kicker">What to do next</p>
                <p className="pg-body mt-2 text-sm">
                  Request a new link. It goes to the email address saved on your booking.
                </p>
              </div>
            </div>
          </GuestPanel>
        }
      />
    </GuestPageFrame>
  );
}
