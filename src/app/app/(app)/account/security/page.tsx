import { ShieldCheck } from 'lucide-react';

import { AccountSessionsPanel } from '@/components/features/account-sessions/AccountSessionsPanel';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Devices & sessions · Nab a Table',
  description: 'Review the devices and recent sessions connected to your account.',
};

export default function OpsAccountSecurityPage() {
  return (
    <OpsPageShell className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="Devices & sessions"
        subtitle="See where your account is signed in and when each session was last used."
        meta={
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4" aria-hidden />
            Only you can see this activity
          </span>
        }
      />
      <AccountSessionsPanel />
    </OpsPageShell>
  );
}
