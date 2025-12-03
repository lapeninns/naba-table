'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

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
  defaultRedirect = '/guest/dashboard' 
}: { 
  defaultRedirect?: string 
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

    // Prevent double processing using ref (synchronous check)
    if (processingRef.current) return;
    processingRef.current = true;

    console.log('[ImplicitAuthHandler] Detected access_token in URL hash');

    const handleImplicitAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        // Parse hash parameters
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) {
          console.error('[ImplicitAuthHandler] Missing tokens in hash', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
          });
          return;
        }

        console.log('[ImplicitAuthHandler] Setting session with tokens...');

        // Set the session manually
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('[ImplicitAuthHandler] Failed to set session:', error);
          return;
        }

        console.log('[ImplicitAuthHandler] Session set successfully:', {
          userId: data.user?.id,
          email: data.user?.email,
        });

        // Clear the hash from the URL (security: don't leave tokens in URL)
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        // Get redirect destination from search params or use default
        const searchParams = new URLSearchParams(window.location.search);
        const redirectedFrom = searchParams.get('redirectedFrom');
        const destination = redirectedFrom || defaultRedirect;

        console.log('[ImplicitAuthHandler] Redirecting to:', destination);

        // Small delay to ensure cookies are flushed before navigation
        await new Promise(resolve => setTimeout(resolve, 100));

        // Use router.replace to avoid adding to history
        router.replace(destination);
        router.refresh();
      } catch (err) {
        console.error('[ImplicitAuthHandler] Unexpected error:', err);
      } finally {
        // Reset processing flag if something went wrong
        // (successful flow redirects away so this won't run)
        processingRef.current = false;
      }
    };

    void handleImplicitAuth();
  }, [router, defaultRedirect]);

  // This component doesn't render anything
  return null;
}
