import { AlertTriangle, KeyRound, Mail, RefreshCw, ShieldCheck } from 'lucide-react';

import {
  GuestContent,
  GuestDetailList,
  GuestHero,
  GuestMetricCard,
  GuestPageFrame,
  GuestPanel,
  GuestPrimaryButton,
  GuestSecondaryButton,
  GuestSplitPanel,
} from '@/components/guest/ui/GuestPageShell';
import { getBookingRecoveryPrimaryAction } from '@/guest/routes/auth-aware-content';
import { getGuestAuthState } from '@/guest/services/auth-state.server';
import { firstString } from '@/lib/api/query-params';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Booking Link Issue · Nab a Table',
  description: "We couldn't verify your booking link.",
};

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const copyByCode: Record<
  string,
  {
    title: string;
    description: string;
    action: string;
  }
> = {
  MISSING_ACCESS_TOKEN: {
    title: 'This booking link is incomplete',
    description:
      'The link is missing the recovery information we need to safely open a booking. Use the latest email or SMS from the venue.',
    action: 'Open the newest confirmation message and try that link instead.',
  },
  ACCESS_TOKEN_NOT_CONFIGURED: {
    title: 'Booking recovery is temporarily unavailable',
    description:
      'Recovery links are not currently enabled for this environment. You can still sign in or contact the venue for help.',
    action: 'Sign in if you have a guest account, or ask the venue to resend confirmation.',
  },
  INVALID_ACCESS_TOKEN: {
    title: 'This booking link could not be verified',
    description:
      'The link does not match a valid booking recovery token. Request a fresh link or sign in to manage your booking.',
    action: 'Use a newer link, or sign in with the same email used for the reservation.',
  },
  ACCESS_TOKEN_EXPIRED: {
    title: 'This booking link has expired',
    description:
      'For safety, booking recovery links expire after a period of time. Your booking may still be valid.',
    action: 'Request a new link or sign in to continue.',
  },
  LEGACY_TOKEN_DEPRECATED: {
    title: 'This older booking link is no longer supported',
    description:
      'The booking system has moved to safer recovery links. Use the latest email or sign in to manage the reservation.',
    action: 'Check your latest confirmation message before trying again.',
  },
  LEGACY_LINK_EXPIRED: {
    title: 'This booking link has been replaced',
    description:
      'We now send a separate, safer link for each booking. Your booking is unchanged; we just need to send you a new link.',
    action: 'Enter your email and we will send a fresh link for your upcoming bookings.',
  },
  ACCESS_TOKEN_REVOKED: {
    title: 'This booking link is no longer valid',
    description:
      'The contact details on this booking have changed since the link was sent, so older links stop working.',
    action: 'Request a new link. It will go to the email address now on the booking.',
  },
  RATE_LIMITED: {
    title: 'Too many attempts',
    description:
      'This link was opened too many times in a short period. Wait a minute and try again.',
    action: 'Try the link again shortly, or request a new one.',
  },
};

const FIND_BOOKING_PATH = '/bookings/find';
/** Codes where a new emailed link cannot work, so it is not offered. */
const NO_NEW_LINK_CODES: ReadonlySet<string> = new Set(['ACCESS_TOKEN_NOT_CONFIGURED']);

export default async function BookingRecoverErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = (await searchParams) ?? {};
  const code = firstString(resolved, 'code') ?? 'INVALID_ACCESS_TOKEN';
  const content = copyByCode[code] ?? copyByCode.INVALID_ACCESS_TOKEN;
  const { isAuthenticated } = await getGuestAuthState();
  const primaryAction = getBookingRecoveryPrimaryAction(isAuthenticated);
  const canEmailNewLink = !NO_NEW_LINK_CODES.has(code);

  return (
    <GuestPageFrame>
      <GuestHero
        compact
        eyebrow="Booking recovery"
        title={content.title}
        description={content.description}
        actions={
          canEmailNewLink ? (
            <>
              <GuestPrimaryButton href={FIND_BOOKING_PATH}>Email me a new link</GuestPrimaryButton>
              <GuestSecondaryButton href={primaryAction.href}>
                {primaryAction.label}
              </GuestSecondaryButton>
            </>
          ) : (
            <GuestPrimaryButton href={primaryAction.href}>{primaryAction.label}</GuestPrimaryButton>
          )
        }
        meta={
          <>
            <span className="pg-chip pg-danger-badge">
              <AlertTriangle className="size-3.5" aria-hidden />
              Link not opened
            </span>
            <span className="pg-chip">
              <ShieldCheck className="size-3.5" aria-hidden />
              Booking protected
            </span>
          </>
        }
        aside={
          <GuestPanel className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="pg-danger-icon flex size-12 shrink-0 items-center justify-center rounded-full">
                <KeyRound className="size-5" aria-hidden />
              </span>
              <div>
                <p className="pg-kicker">What to do next</p>
                <p className="pg-body mt-2 text-sm">{content.action}</p>
              </div>
            </div>
          </GuestPanel>
        }
      />

      <GuestContent>
        <GuestSplitPanel
          primary={
            <GuestDetailList
              title="Recovery checklist"
              items={[
                {
                  icon: Mail,
                  label: 'Latest message',
                  value: 'Use the newest email or SMS from the restaurant.',
                  detail: 'Older recovery links can expire or be replaced.',
                },
                {
                  icon: RefreshCw,
                  label: 'Fresh link',
                  value: 'Request a new link with the email address on your booking.',
                  detail:
                    'Booked by phone or with a different email? The venue can update it and resend your confirmation.',
                },
                {
                  icon: ShieldCheck,
                  label: 'Guest account',
                  value: 'Signed in when you open a booking link? It is saved to your account.',
                  detail: 'Bookings saved to your account appear in My bookings.',
                },
              ]}
            />
          }
          secondary={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <GuestMetricCard
                icon={KeyRound}
                label="Reason code"
                value={code.replaceAll('_', ' ')}
                detail="Used only to explain why the link stopped here."
              />
              <GuestMetricCard
                icon={ShieldCheck}
                label="Safety"
                value="Protected"
                detail="We do not open booking details from unverified links."
              />
            </div>
          }
        />
      </GuestContent>
    </GuestPageFrame>
  );
}
