"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useEffect, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Crisp } from "crisp-sdk-web";
import NextTopLoader from "nextjs-toploader";
import { Toaster as HotToaster } from "react-hot-toast";
import { Tooltip } from "react-tooltip";
import config from "@/config";
import type { User } from "@supabase/supabase-js";
import { CustomerNavbar } from "@/components/customer/navigation";
import { Toaster as UiToaster } from "@/components/ui/toaster";

// Crisp customer chat support:
// This component is separated from ClientLayout because it needs to be wrapped with <SessionProvider> to use useSession() hook
const CrispChat = (): null => {
  const pathname = usePathname();

  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState<User | null>(null);

  // This is used to get the user data from Supabase Auth (if logged in) => user ID is used to identify users in Crisp
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setData(session.user);
      }
    };
    getUser();
  }, [supabase]);

  useEffect(() => {
    if (config?.crisp?.id) {
      // Set up Crisp
      Crisp.configure(config.crisp.id);

      // (Optional) If onlyShowOnRoutes array is not empty in config.js file, Crisp will be hidden on the routes in the array.
      // Use <AppButtonSupport> instead to show it (user clicks on the button to show Crisp—it cleans the UI)
      if (
        config.crisp.onlyShowOnRoutes &&
        pathname &&
        !config.crisp.onlyShowOnRoutes?.includes(pathname)
      ) {
        Crisp.chat.hide();
        Crisp.chat.onChatClosed(() => {
          Crisp.chat.hide();
        });
      }
    }
  }, [pathname]);

  // Add User Unique ID to Crisp to easily identify users when reaching support (optional)
  useEffect(() => {
    if (data && config?.crisp?.id) {
      Crisp.session.setData({ userId: data.id });
    }
  }, [data]);

  return null;
};

// All the client wrappers are here (they can't be in server components)
// 1. NextTopLoader: Show a progress bar at the top when navigating between pages
// 2. Toaster: Show Success/Error messages anywhere from the app with toast()
// 3. Tooltip: Show tooltips if any JSX elements has these 2 attributes: data-tooltip-id="tooltip" data-tooltip-content=""
// 4. CrispChat: Set Crisp customer chat support (see above)
const ClientLayout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const isOpsRoute = pathname?.startsWith("/ops") ?? false;

  return (
    <>
      {/* Show a progress bar at the top when navigating between pages */}
      <NextTopLoader color={config.colors.main} showSpinner={false} />

      {!isOpsRoute && <CustomerNavbar />}

      {/* Content inside app/page.js files  */}
      {children}

      {/* Legacy toast notifications (react-hot-toast) */}
      <HotToaster
        toastOptions={{
          duration: 3000,
        }}
      />

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
