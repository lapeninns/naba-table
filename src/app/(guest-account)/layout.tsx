import type { ReactNode } from "react";

import Footer from "@/components/Footer";
import { CustomerNavbar } from "@/components/customer/navigation";

type GuestAccountLayoutProps = {
  children: ReactNode;
};

export default function GuestAccountLayout({ children }: GuestAccountLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <CustomerNavbar />
      <main id="main-content" className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
