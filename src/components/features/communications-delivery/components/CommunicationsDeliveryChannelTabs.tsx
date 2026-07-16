'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tab = {
  href: string;
  label: string;
  description: string;
  active: boolean;
  badge?: string | null;
};

export type CommunicationsDeliveryChannelTabsProps = {
  active: 'overview' | 'email' | 'messages';
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
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-3" aria-label="Communications delivery sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch={false}
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
          <p className="mt-1 text-sm text-muted-foreground">{tab.description}</p>
        </Link>
      ))}
    </section>
  );
}
