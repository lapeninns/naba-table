'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

type Tab = {
  href: string;
  label: string;
  description: string;
  active: boolean;
  badge?: string | null;
};

export type CommunicationsDeliveryChannelTabsProps = {
  active: 'overview' | 'email' | 'messages' | 'reviews';
};

export function CommunicationsDeliveryChannelTabs({
  active,
}: CommunicationsDeliveryChannelTabsProps) {
  const tabs: Tab[] = [
    {
      href: '/app/communications-delivery',
      label: 'Overview',
      description: 'Email, SMS, and WhatsApp health at a glance',
      active: active === 'overview',
    },
    {
      href: '/app/communications-delivery/email',
      label: 'Email',
      description: 'Email log, queue, analytics, and retry',
      active: active === 'email',
      badge: 'Resend',
    },
    {
      href: '/app/communications-delivery/messages',
      label: 'Messages',
      description: 'SMS and WhatsApp monitoring',
      active: active === 'messages',
      badge: 'Twilio',
    },
    {
      href: '/app/communications-delivery/reviews',
      label: 'Reviews',
      description: 'Post-visit conversion and channel efficiency',
      active: active === 'reviews',
      badge: 'Growth',
    },
  ];

  return (
    <section
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      aria-label="Communications delivery sections"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch={false}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'rounded-xl border p-4 transition-colors',
            tab.active
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/30 hover:bg-muted/50',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-foreground">{tab.label}</div>
            {tab.badge ? (
              <Badge variant="outline" className="text-[10px] uppercase">
                {tab.badge}
              </Badge>
            ) : null}
          </div>
          <Text variant="caption" className="mt-1">
            {tab.description}
          </Text>
        </Link>
      ))}
    </section>
  );
}
