"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import config from "@/config";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

type CrispApi = typeof import("crisp-sdk-web").Crisp | null;

// Crisp customer chat support:
// This component is separated to enable dynamic loading in the root client layout.
export const CrispChat = (): null => {
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
