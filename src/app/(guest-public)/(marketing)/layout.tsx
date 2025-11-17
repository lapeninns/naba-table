
import Footer from "@/components/Footer";
import { CustomerNavbar } from "@/components/customer/navigation";

import type { ReactNode } from "react";

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <CustomerNavbar />
      <main id="main-content" className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer variant="compact" />
    </div>
  );
}
