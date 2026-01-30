'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { ImplicitAuthHandler } from '@/components/auth/ImplicitAuthHandler';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { Toaster as UiToaster } from '@/components/ui/toaster';
import config from '@/config';
import { toast } from '@/hooks/use-toast';
import { SESSION_EXPIRED_EVENT } from '@/lib/http/sessionRedirect';

import type { ReactNode } from 'react';

const NextTopLoader = dynamic(() => import('nextjs-toploader'), { ssr: false });
const HotToaster = dynamic(() => import('react-hot-toast').then((mod) => mod.Toaster), {
  ssr: false,
});
const Tooltip = dynamic(() => import('react-tooltip').then((mod) => mod.Tooltip), { ssr: false });
const CrispChat = dynamic(() => import('./CrispChat').then((mod) => mod.CrispChat), { ssr: false });

const LEGACY_TOASTER_BLOCKLIST = [/^\/checkout(?:$|\/)/];

const AUTH_ROUTE_PREFIXES = [/^\/auth(\/|$)/, /^\/app\/auth(\/|$)/];

// All the client wrappers are here (they can't be in server components)
// 1. NextTopLoader: Show a progress bar at the top when navigating between pages
// 2. Toaster: Show Success/Error messages anywhere from the app with toast()
// 3. Tooltip: Show tooltips if any JSX elements has these 2 attributes: data-tooltip-id="tooltip" data-tooltip-content=""
// 4. CrispChat: Set Crisp customer chat support (see above)
const ClientLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isAuthRoute = useMemo(
    () => (pathname ? AUTH_ROUTE_PREFIXES.some((pattern) => pattern.test(pathname)) : false),
    [pathname],
  );
  const suppressLegacyToaster = pathname
    ? LEGACY_TOASTER_BLOCKLIST.some((pattern) => pattern.test(pathname))
    : false;

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      toast({
        title: 'Session expired',
        description: detail?.message ?? 'Please sign in again to continue.',
        variant: 'destructive',
      });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  if (isAuthRoute) {
    return (
      <>
        <ImplicitAuthHandler defaultRedirect="/guest/dashboard" />
        {children}
        {/* Keep UI toasts available for auth flows without loading the full ops shell stack */}
        <UiToaster />
      </>
    );
  }

  return (
    <>
      {/* Handle implicit Supabase hash tokens globally (magic link / OAuth) */}
      <ImplicitAuthHandler defaultRedirect="/guest/dashboard" />
      {/* Show a progress bar at the top when navigating between pages */}
      <NextTopLoader color={config.colors.main} showSpinner={false} />

      {/* Content inside app/page.js files  */}
      {children}

      <CookieConsentBanner />

      {/* Legacy toast notifications (react-hot-toast) */}
      {!suppressLegacyToaster ? (
        <HotToaster
          toastOptions={{
            duration: 3000,
          }}
        />
      ) : null}

      {/* Shadcn toast stack for ops dashboards */}
      <UiToaster />

      {/* Show tooltips if any JSX elements has these 2 attributes: data-tooltip-id="tooltip" data-tooltip-content="" */}
      <Tooltip id="tooltip" className="z-[60] !opacity-100 max-w-sm shadow-lg" />

      {/* Set Crisp customer chat support */}
      <CrispChat />
    </>
  );
};

export default ClientLayout;
