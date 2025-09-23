"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, CalendarDays, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/wishlists", label: "Wishlists", icon: Heart },
  { href: "/trips", label: "Trips", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      role="tablist"
      aria-label="Bottom navigation"
      className={cn(
        "bottom-tabs fixed inset-x-0 bottom-0 z-50",
        "h-[83px] bg-[color:var(--color-surface)] shadow-header",
        "px-6 pb-[calc(env(safe-area-inset-bottom,0)+8px)]",
      )}
    >
      <div className="mx-auto grid max-w-[393px] grid-cols-5 items-end gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              role="tab"
              aria-selected={!!active}
              className={cn(
                "tab-item flex flex-col items-center justify-center gap-1 py-2",
                "min-h-[var(--touch-target)]",
                active ? "text-[color:var(--color-primary)]" : "text-[color:var(--color-text-secondary)]",
              )}
            >
              <Icon aria-hidden className="h-6 w-6" />
              <span className="text-[12px] leading-[16px]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

