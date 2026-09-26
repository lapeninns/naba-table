'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

import type { PersistentGbpError } from './googleBusinessProfileWorkflow';
import type { Dispatch, SetStateAction } from 'react';

type SearchParamsLike = {
  get(name: string): string | null;
};

const GENERIC_CALLBACK_ERROR =
  'Google Business Profile connection failed. Connect Google to try again.';

// The callback route redirects with one of these fixed messages. Anything else in `?message=`
// is free text (it can carry an exception message or be crafted by a link), so it is ignored.
const KNOWN_CALLBACK_ERRORS: ReadonlyMap<string, string> = new Map([
  [
    'Google authorization was cancelled or denied.',
    'Google authorization was cancelled or denied. Connect Google to try again.',
  ],
  [
    'Google authorization response was incomplete.',
    'Google authorization did not complete. Connect Google to try again.',
  ],
  [
    'Google authorization state could not be verified.',
    'Google authorization could not be verified. Connect Google to try again.',
  ],
  [
    'Google authorization state did not match this restaurant.',
    'Google authorization was for a different restaurant. Connect Google to try again.',
  ],
  [
    'Sign in to Nabatable before connecting Google.',
    'Sign in to Nabatable before connecting Google.',
  ],
]);

export function getGoogleBusinessProfileCallbackErrorCopy(message: string | null): string {
  return (message && KNOWN_CALLBACK_ERRORS.get(message)) || GENERIC_CALLBACK_ERROR;
}

type UseGoogleBusinessProfileCallbackStatusOptions = {
  searchParams: SearchParamsLike;
  setPersistentError: Dispatch<SetStateAction<PersistentGbpError | null>>;
};

export function useGoogleBusinessProfileCallbackStatus({
  searchParams,
  setPersistentError,
}: UseGoogleBusinessProfileCallbackStatusOptions) {
  useEffect(() => {
    const gbpStatus = searchParams.get('gbp');
    const message = searchParams.get('message');
    if (!gbpStatus) {
      return;
    }

    if (gbpStatus === 'connected') {
      setPersistentError(null);
      toast.success('Google Business Profile connected. Choose a location to finish linking.');
    } else if (gbpStatus === 'error') {
      const errorMessage = getGoogleBusinessProfileCallbackErrorCopy(message);
      setPersistentError({
        kind: 'callback',
        title: 'Google connection failed',
        message: errorMessage,
      });
      toast.error(errorMessage);
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('gbp');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, setPersistentError]);
}
