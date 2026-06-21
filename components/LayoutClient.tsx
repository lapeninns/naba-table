'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { ImplicitAuthHandler } from '@/components/auth/ImplicitAuthHandler';
import { Toaster } from '@/components/ui/sonner';
import config from '@/config';
import { resolveDocumentThemeForPathname } from '@/lib/theme/documentTheme';

import type { ReactNode } from 'react';

const NextTopLoader = dynamic(() => import('nextjs-toploader'), { ssr: false });
const CrispChat = dynamic(() => import('./CrispChat').then((mod) => mod.CrispChat), { ssr: false });

const AUTH_ROUTE_PREFIXES = [/^\/auth(\/|$)/, /^\/app\/auth(\/|$)/];

// All the client wrappers are here (they can't be in server components)
// 1. NextTopLoader: Show a progress bar at the top when navigating between pages
// 2. CrispChat: Set Crisp customer chat support (see above)
const ClientLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const [hasMounted, setHasMounted] = useState(false);
  const documentTheme = useMemo(
    () =>
      resolveDocumentThemeForPathname(
        pathname,
        typeof window === 'undefined' ? null : window.location.hostname,
      ),
    [pathname],
  );
  const isAuthRoute = useMemo(
    () => (pathname ? AUTH_ROUTE_PREFIXES.some((pattern) => pattern.test(pathname)) : false),
    [pathname],
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', documentTheme);

    if (documentTheme === 'guest') {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      return;
    }

    root.style.removeProperty('color-scheme');
  }, [documentTheme]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (isAuthRoute) {
    return (
      <>
        <ImplicitAuthHandler defaultRedirect="/guest/dashboard" />
        {children}
      </>
    );
  }

  return (
    <>
      {/* Handle implicit Supabase hash tokens globally (magic link / OAuth) */}
      <ImplicitAuthHandler defaultRedirect="/guest/dashboard" />
      {/* Show a progress bar at the top when navigating between pages */}
      {hasMounted ? <NextTopLoader color={config.colors.main} showSpinner={false} /> : null}

      {/* Content inside app/page.js files  */}
      {children}

      <Toaster richColors closeButton />

      <Toaster richColors closeButton />

      {/* Set Crisp customer chat support */}
      {hasMounted ? <CrispChat /> : null}
    </>
  );
};

export default ClientLayout;
