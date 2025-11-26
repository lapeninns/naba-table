'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { RESTAURANT_SETTINGS_NAV_ITEMS } from './routes';

export function RestaurantSettingsSubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Restaurant settings" className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-lg border border-border/60 bg-muted/40 p-1">
        {RESTAURANT_SETTINGS_NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex min-w-[180px] flex-col gap-1 rounded-md px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground hover:ring-1 hover:ring-border'
              )}
            >
              <span className="leading-5">{item.title}</span>
              <span className="text-xs font-normal text-muted-foreground/90">{item.description}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
