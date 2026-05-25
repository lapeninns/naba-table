import { ChevronRight, ReceiptText, User } from 'lucide-react';
import Link from 'next/link';

import { GuestPanel } from '@/components/guest/ui';

import type { LucideIcon } from 'lucide-react';

export function GuestDashboardQuickLinks() {
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-24">
      <GuestPanel className="p-5">
        <div className="flex flex-col gap-1">
          <p className="pg-kicker">Account</p>
          <h2 className="pg-card-title">Quick links</h2>
          <p className="pg-caption">
            Profile details and receipts stay available when you need them.
          </p>
        </div>
        <div className="mt-4 grid gap-2">
          <AccountLink
            icon={User}
            href="/guest/profile"
            title="Profile"
            description="Contact details and preferences"
          />
          <AccountLink
            icon={ReceiptText}
            href="/guest/bookings?tab=history"
            title="Receipts"
            description="Past bookings and receipt pages"
          />
        </div>
      </GuestPanel>
    </aside>
  );
}

function AccountLink({
  icon: Icon,
  href,
  title,
  description,
}: {
  icon: LucideIcon;
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="pg-focus-ring block rounded-[var(--pg-radius-md)]">
      <div className="pg-touch flex items-center gap-3 rounded-[var(--pg-radius-md)] border border-border/70 bg-background/80 p-3 transition hover:border-primary/25 hover:bg-background">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="pg-caption block">{description}</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </div>
    </Link>
  );
}
