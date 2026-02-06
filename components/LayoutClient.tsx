"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { ImplicitAuthHandler } from "@/components/auth/ImplicitAuthHandler";
import { Toaster } from "@/components/ui/sonner";
import config from "@/config";

import type { ReactNode } from "react";

const NextTopLoader = dynamic(() => import("nextjs-toploader"), { ssr: false });
const Tooltip = dynamic(() => import("react-tooltip").then((mod) => mod.Tooltip), { ssr: false });
const CrispChat = dynamic(() => import("./CrispChat").then((mod) => mod.CrispChat), { ssr: false });

const AUTH_ROUTE_PREFIXES = [/^\/auth(\/|$)/, /^\/app\/auth(\/|$)/];

// All the client wrappers are here (they can't be in server components)
// 1. NextTopLoader: Show a progress bar at the top when navigating between pages
// 2. Tooltip: Show tooltips if any JSX elements has these 2 attributes: data-tooltip-id="tooltip" data-tooltip-content=""
// 3. CrispChat: Set Crisp customer chat support (see above)
const ClientLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isAuthRoute = useMemo(
    () => (pathname ? AUTH_ROUTE_PREFIXES.some((pattern) => pattern.test(pathname)) : false),
    [pathname],
  );

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
      <NextTopLoader color={config.colors.main} showSpinner={false} />

      {/* Content inside app/page.js files  */}
      {children}

      {/* Show tooltips if any JSX elements has these 2 attributes: data-tooltip-id="tooltip" data-tooltip-content="" */}
      <Tooltip
        id="tooltip"
        className="z-[60] !opacity-100 max-w-sm shadow-lg"
      />

      <Toaster richColors closeButton />

      {/* Set Crisp customer chat support */}
      <CrispChat />
    </>
  );
};

export default ClientLayout;
