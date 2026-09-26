'use client';

import { AlertCircle, Check, Loader2, Lock, MapPin } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { GbpStatusPill } from './GbpStatusPill';
import { describeGbpConnection } from '../gbpPageModel';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

type StepState = 'done' | 'current' | 'locked';

function Step({
  n,
  state,
  title,
  id,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <li
      id={id}
      data-state={state}
      className="grid scroll-mt-24 content-start gap-1.5 border-b px-4 py-3.5 last:border-b-0 sm:px-5 @3xl:border-b-0 @3xl:border-r @3xl:last:border-r-0"
    >
      <h3
        className={cn(
          'flex items-center gap-2 text-sm font-semibold',
          state === 'locked' && 'text-muted-foreground',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'grid size-[22px] place-items-center rounded-full text-xs font-semibold',
            state === 'done' && 'bg-foreground text-background',
            state === 'current' && 'ring-2 ring-inset ring-foreground',
            state === 'locked' && 'ring-1 ring-inset ring-border',
          )}
        >
          {state === 'done' ? <Check className="size-3" /> : n}
        </span>
        <span className="sr-only">
          {`Step ${n}, ${state === 'done' ? 'done' : state === 'current' ? 'to do now' : 'not available yet'}: `}
        </span>
        {title}
      </h3>
      <div className="grid gap-2 text-sm text-muted-foreground">{children}</div>
    </li>
  );
}

export type GbpSetupCardProps = {
  readonly data: GoogleBusinessProfileConnection;
  readonly accountLabel: string;
  /** A failed connect attempt reported by the API. */
  readonly connectError: string | null;
  readonly onConnect: () => void;
  readonly isConnecting: boolean;
  readonly onChooseLocation: () => void;
  readonly locationsErrorMessage: string | null;
  readonly onRetryLocations: () => void;
  readonly isRetryingLocations: boolean;
  readonly onRequestDisconnect: (() => void) | null;
};

/**
 * Linking a Google listing: sign in, choose the listing, then review. Shown until a listing is
 * linked; nothing is sent to Google from here.
 */
export function GbpSetupCard({
  data,
  accountLabel,
  connectError,
  onConnect,
  isConnecting,
  onChooseLocation,
  locationsErrorMessage,
  onRetryLocations,
  isRetryingLocations,
  onRequestDisconnect,
}: GbpSetupCardProps) {
  const { status } = data;
  const connection = describeGbpConnection(status);
  const signedIn = status === 'authorized';
  const signInState: StepState = signedIn ? 'done' : 'current';
  const chooseState: StepState = signedIn ? 'current' : 'locked';
  const locationCount = data.availableLocations.length;

  return (
    <section
      id="gbp-connection"
      aria-labelledby="gbp-setup-title"
      data-testid="gbp-setup-card"
      className="@container min-w-0 scroll-mt-24 rounded-xl border bg-background"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 id="gbp-setup-title" className="text-base font-semibold">
            Link your Google listing
          </h2>
          <p className="mt-0.5 max-w-[72ch] text-sm text-muted-foreground">
            Optional. Once linked, Nabatable shows where your public details differ from Google, and
            publishes only the changes you confirm. Bookings work without it.
          </p>
        </div>
        <GbpStatusPill label="Connection" value={connection.label} tone={connection.tone} />
      </div>

      {!data.isConfigured || connectError ? (
        <div className="grid gap-2 px-4 pt-3 sm:px-5">
          {!data.isConfigured ? (
            <Alert variant="warning">
              <Lock className="size-4" aria-hidden />
              <AlertTitle>Google connection is not set up for this workspace</AlertTitle>
              <AlertDescription>
                Google Business Profile credentials are missing in this environment, so connecting
                is unavailable. Ask your Nabatable administrator to add them.
              </AlertDescription>
            </Alert>
          ) : null}
          {connectError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertTitle>Google did not connect</AlertTitle>
              <AlertDescription className="break-words">{connectError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <ol className="mt-3.5 grid border-t @3xl:grid-cols-3">
        <Step n={1} state={signInState} title="Sign in with Google">
          {signedIn ? (
            <p>Signed in as {accountLabel}.</p>
          ) : status === 'pending_auth' ? (
            <p>
              Waiting for Google. Finish the consent screen in the Google tab. If you closed it,
              start again.
            </p>
          ) : status === 'reauth_required' ? (
            <p>
              Google access has expired. Sign in again with the account that manages the listing.
            </p>
          ) : (
            <p>Use the Google account that manages this venue’s listing.</p>
          )}
          {signedIn ? null : (
            <div>
              <Button
                type="button"
                onClick={onConnect}
                disabled={!data.isConfigured || isConnecting}
                aria-busy={isConnecting || undefined}
              >
                {isConnecting ? (
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                ) : null}
                {isConnecting
                  ? 'Connecting…'
                  : status === 'pending_auth'
                    ? 'Start Google sign-in again'
                    : status === 'reauth_required'
                      ? 'Reconnect Google'
                      : 'Connect Google'}
              </Button>
            </div>
          )}
        </Step>
        <Step n={2} state={chooseState} title="Choose the listing" id="gbp-location">
          {chooseState === 'locked' ? (
            <p>Available after sign-in.</p>
          ) : (
            <p>
              {locationCount
                ? `${locationCount} ${locationCount === 1 ? 'listing' : 'listings'} found for this account. Pick the one for this venue.`
                : 'Pick the listing for this venue.'}
            </p>
          )}
          {chooseState === 'current' && locationsErrorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertTitle>Listings didn’t load</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <span className="break-words">{locationsErrorMessage}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetryLocations}
                  disabled={isRetryingLocations}
                >
                  {isRetryingLocations ? 'Retrying…' : 'Try again'}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {chooseState === 'current' ? (
            <div>
              <Button type="button" onClick={onChooseLocation}>
                <MapPin data-icon="inline-start" aria-hidden />
                Choose listing
              </Button>
            </div>
          ) : null}
        </Step>
        <Step n={3} state="locked" title="Review differences">
          <p>Nothing is sent to Google until you review and confirm an exact plan.</p>
        </Step>
      </ol>

      {onRequestDisconnect ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground sm:px-5">
          <span>Signed in with the wrong Google account?</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="gbp-disconnect-button"
            onClick={onRequestDisconnect}
          >
            Disconnect Google
          </Button>
        </div>
      ) : null}
    </section>
  );
}
