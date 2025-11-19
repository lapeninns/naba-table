import { CustomerNavbar } from "@/components/customer/navigation";
import Footer from "@/components/Footer";

import type { ReactNode } from "react";


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
      <Footer variant="compact" />
    </div>
  );
}
