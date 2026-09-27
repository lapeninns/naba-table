'use client';

import { ChartNoAxesCombined, Mail, MessageCircle, Star, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tab = {
  key: CommunicationsDeliveryChannelTabsProps['active'];
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string | null;
};

export type CommunicationsDeliveryChannelTabsProps = {
  active: 'overview' | 'email' | 'messages' | 'reviews';
};

const TABS: Tab[] = [
  {
    key: 'overview',
    href: '/app/communications-delivery',
    label: 'Overview',
    icon: ChartNoAxesCombined,
    description: 'Email, SMS, and WhatsApp health at a glance',
  },
  {
    key: 'email',
    href: '/app/communications-delivery/email',
    label: 'Email',
    icon: Mail,
    description: 'Email log, queue, analytics, and retry',
    badge: 'Resend',
  },
  {
    key: 'messages',
    href: '/app/communications-delivery/messages',
    label: 'Messages',
    icon: MessageCircle,
    description: 'SMS and WhatsApp monitoring',
    badge: 'Twilio',
  },
  {
    key: 'reviews',
    href: '/app/communications-delivery/reviews',
    label: 'Reviews',
    icon: Star,
    description: 'Post-visit conversion and channel efficiency',
    badge: 'Growth',
  },
];

/**
 * Section navigation shared by Overview, Email, Messages and Reviews.
 *
 * Compact tabs scroll horizontally when the viewport cannot fit the full row.
 */
export function CommunicationsDeliveryChannelTabs({
  active,
}: CommunicationsDeliveryChannelTabsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const searchParams = useSearchParams();
  const context = new URLSearchParams();
  const restaurantId = searchParams?.get('restaurantId');
  const range = searchParams?.get('range');
  if (restaurantId) context.set('restaurantId', restaurantId);
  if (range === '24h' || range === '7d' || range === '30d') context.set('range', range);

  // Keep the current section visible in the scrolling phone row without moving the page.
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = Math.max(0, current.offsetLeft - list.offsetLeft - 16);
  }, [active]);

  return (
    <nav aria-label="Communications delivery sections" className="border-b border-border">
      <ul ref={listRef} className="-mb-px flex overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={context.size ? `${tab.href}?${context}` : tab.href}
                prefetch={false}
                aria-current={isActive ? 'page' : undefined}
                title={tab.description}
                className={cn(
                  'flex min-h-11 flex-col justify-center gap-0.5 rounded-t-md border-b-2 px-3 py-2 outline-none sm:min-h-9',
                  'transition-colors duration-[var(--pg-duration-fast)] ease-[var(--pg-ease-out)] motion-reduce:transition-none',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/30',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2 whitespace-nowrap md:flex-wrap md:gap-x-2 md:gap-y-1 md:whitespace-normal">
                  <tab.icon className="size-4" aria-hidden />
                  <span className={cn('text-sm', isActive ? 'font-semibold' : 'font-medium')}>
                    {tab.label}
                  </span>
                  {tab.badge ? (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 text-[length:var(--pg-text-kicker)] font-semibold uppercase tracking-[var(--pg-tracking-wide)] text-muted-foreground"
                    >
                      {tab.badge}
                    </Badge>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
