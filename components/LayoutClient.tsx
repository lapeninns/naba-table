"use client";

import { usePathname } from "next/navigation";
import NextTopLoader from "nextjs-toploader";
import { useEffect, useMemo, useState } from "react";
import { Toaster as HotToaster } from "react-hot-toast";
import { Tooltip } from "react-tooltip";

import { Toaster as UiToaster } from "@/components/ui/toaster";
import config from "@/config";
import { ImplicitAuthHandler } from "@/components/auth/ImplicitAuthHandler";
import { toast } from "@/hooks/use-toast";
import { SESSION_EXPIRED_EVENT } from "@/lib/http/sessionRedirect";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import type { ReactNode } from "react";

type CrispApi = typeof import("crisp-sdk-web").Crisp | null;

// Crisp customer chat support:
// This component is separated from ClientLayout because it needs to be wrapped with <SessionProvider> to use useSession() hook
const CrispChat = (): null => {
  const pathname = usePathname();
  const { user } = useSupabaseSession();
  const [crisp, setCrisp] = useState<CrispApi>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCrisp = async () => {
      if (!config?.crisp?.id) return;
      const module = await import("crisp-sdk-web");
      if (!isMounted) return;
      setCrisp(module.Crisp);
    };

    loadCrisp();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!crisp || !config?.crisp?.id) return;

    crisp.configure(config.crisp.id);

    // (Optional) If onlyShowOnRoutes array is not empty in config.js file, Crisp will be hidden on the routes in the array.
    // Use <AppButtonSupport> instead to show it (user clicks on the button to show Crisp—it cleans the UI)
    if (config.crisp.onlyShowOnRoutes && pathname && !config.crisp.onlyShowOnRoutes?.includes(pathname)) {
      crisp.chat.hide();
      crisp.chat.onChatClosed(() => {
        crisp.chat.hide();
      });
    }
  }, [crisp, pathname]);

  // Add User Unique ID to Crisp to easily identify users when reaching support (optional)
  useEffect(() => {
    if (user?.id && config?.crisp?.id && crisp) {
      crisp.session.setData({ userId: user.id });
    }
  }, [crisp, user?.id]);

  return null;
};

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
        title: "Session expired",
        description: detail?.message ?? "Please sign in again to continue.",
        variant: "destructive",
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
      <Tooltip
        id="tooltip"
        className="z-[60] !opacity-100 max-w-sm shadow-lg"
      />

      {/* Set Crisp customer chat support */}
      <CrispChat />
    </>
  );
};

export default ClientLayout;
