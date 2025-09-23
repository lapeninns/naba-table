import type { ReactNode } from "react";
import BottomTabs from "@/components/mobile/BottomTabs";

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[393px] bg-[color:var(--color-background)] pb-[100px]">
      {children}
      <BottomTabs />
    </div>
  );
}

