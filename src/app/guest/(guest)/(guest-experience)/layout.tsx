import type { ReactNode } from "react";


interface GuestExperienceLayoutProps {
  children: ReactNode;
}

export default function GuestExperienceLayout({ children }: GuestExperienceLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main id="main-content" className="flex-1 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
