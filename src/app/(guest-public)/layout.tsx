import type { ReactNode } from "react";

type GuestPublicLayoutProps = {
  children: ReactNode;
};

export default function GuestPublicLayout({ children }: GuestPublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
