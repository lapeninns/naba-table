"use client";
import { Compass, Heart, CalendarDays, MessageSquare, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/wishlists", label: "Wishlists", icon: Heart },
  { href: "/trips", label: "Trips", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/profile/manage", label: "Profile", icon: User },
];

export default function BottomTabs() {
  const pathname = usePathname();
  const activeValue = tabs.find(({ href }) => pathname?.startsWith(href))?.href ?? tabs[0]?.href;

  return (
    <Tabs value={activeValue}>
      <nav
        aria-label="Bottom navigation"
        className={cn(
          "bottom-tabs fixed inset-x-0 bottom-0 z-50",
          "h-[83px] bg-[color:var(--color-surface)] shadow-header",
          "px-6 pb-[calc(env(safe-area-inset-bottom,0)+8px)]",
        )}
      >
        <TabsList className="mx-auto grid h-full max-w-[393px] grid-cols-5 items-end gap-1 bg-transparent p-0">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = activeValue === href;
            return (
              <TabsTrigger
                key={href}
                value={href}
                asChild
                className={cn(
                  "tab-item flex flex-col items-center justify-center gap-1 rounded-none border-none bg-transparent py-2",
                  "min-h-[var(--touch-target)] text-[color:var(--color-text-secondary)] shadow-none",
                  "data-[state=active]:text-[color:var(--color-primary)]",
                  active ? "text-[color:var(--color-primary)]" : undefined,
                )}
              >
                <Link href={href} aria-current={active ? "page" : undefined}>
                  <Icon aria-hidden className="h-6 w-6" />
                  <span className="text-[12px] leading-[16px]">{label}</span>
                </Link>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </nav>
    </Tabs>
  );
}
