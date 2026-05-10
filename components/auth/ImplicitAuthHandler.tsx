'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

// Module-level guard to prevent duplicate hash processing across multiple handler instances/layouts
let handledHashSignature: string | null = null;
let redirectInFlight = false;

/**
 * Client-side handler for Supabase implicit OAuth flow.
 *
 * When using admin.generateLink(), Supabase returns tokens via URL hash (#access_token=...).
 * The server-side callback cannot see URL fragments, so this component handles
 * the token exchange on the client side.
 *
 * Place this component in layouts that might receive implicit auth redirects.
 */
export function ImplicitAuthHandler({
  defaultRedirect = '/guest/dashboard',
}: {
  defaultRedirect?: string;
}) {
  const router = useRouter();
  const processingRef = useRef(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;

    // Check if URL hash contains access_token (implicit flow)
    if (!hash || !hash.includes('access_token')) {
      return;
    }

    const signature = hash; // include full fragment to avoid double-processing same payload
    if (handledHashSignature === signature || redirectInFlight) {
      return;
    }

    // Prevent double processing using both ref and module-level guard
    if (processingRef.current) return;
    processingRef.current = true;
    handledHashSignature = signature;

    const log = (...args: unknown[]) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[ImplicitAuthHandler]', ...args);
      }
    };

    log('Detected access_token in URL hash');

    const resetRedirectGuards = () => {
      redirectInFlight = false;
      // Allow future implicit logins (even with the same link) after navigation settles
      handledHashSignature = null;
    };

    const timers = new Set<ReturnType<typeof setTimeout>>();
    const scheduleTimer = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
    };

    const waitForCookieFlush = () =>
      new Promise<void>((resolve) => {
        scheduleTimer(resolve, 50);
      });

    const handleImplicitAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        // Parse hash parameters
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) {
          log('Missing tokens in hash', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
          });
          return;
        }

        log('Setting session with tokens...');

        // Set the session manually
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          log('Failed to set session:', error);
          handledHashSignature = null;
          return;
        }

        log('Session set successfully:', {
          userId: data.user?.id,
          email: data.user?.email,
        });

        // Clear the hash from the URL (security: don't leave tokens in URL)
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        // Get redirect destination from search params or use default
        const searchParams = new URLSearchParams(window.location.search);
        const redirectedFrom = searchParams.get('redirectedFrom');

        // Validate destination is an internal path to prevent open redirect vulnerabilities
        let destination = defaultRedirect;
        if (redirectedFrom && redirectedFrom.startsWith('/') && !redirectedFrom.startsWith('//')) {
          destination = redirectedFrom;
        }

        log('Redirecting to:', destination);

        // Small delay to ensure cookies are flushed before navigation
        await waitForCookieFlush();

        redirectInFlight = true;
        router.replace(destination);

        // Clear redirect guard after navigation kick-off so subsequent implicit logins work without reload
        scheduleTimer(resetRedirectGuards, 200);
      } catch (err) {
        log('Unexpected error:', err);
        handledHashSignature = null;
        redirectInFlight = false;
      } finally {
        // Reset processing flag if something went wrong (successful flow navigates away)
        processingRef.current = false;
        // Safety: if navigation did not unmount this handler, allow future attempts
        if (redirectInFlight) {
          resetRedirectGuards();
        }
      }
    };

    void handleImplicitAuth();

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      // Ensure guards don't persist across unmounts
      resetRedirectGuards();
      processingRef.current = false;
    };
  }, [router, defaultRedirect]);

  // This component doesn't render anything
  return null;
}
