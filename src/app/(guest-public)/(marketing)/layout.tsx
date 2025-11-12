import type { ReactNode } from "react";

import { OwnerMarketingFooter } from "@/components/owner-marketing/OwnerMarketingFooter";
import { OwnerMarketingNavbar } from "@/components/owner-marketing/OwnerMarketingNavbar";

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <OwnerMarketingNavbar />
      <main id="main-content" className="flex-1 focus:outline-none">
        {children}
      </main>
      <OwnerMarketingFooter />
    </div>
  );
}
