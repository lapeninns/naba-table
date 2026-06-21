'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

import type { PersistentGbpError } from './googleBusinessProfileWorkflow';
import type { Dispatch, SetStateAction } from 'react';

type SearchParamsLike = {
  get(name: string): string | null;
};

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
      const errorMessage = message ?? 'Google Business Profile connection failed.';
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
