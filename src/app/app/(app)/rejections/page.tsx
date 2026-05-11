'use client';

import Link from 'next/link';

import { OpsRejectionDashboard } from '@/components/features/dashboard/rejections';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOpsSession } from '@/contexts/ops-session';

export default function OpsRejectionsPage() {
  const { featureFlags } = useOpsSession();

  if (!featureFlags.rejectionAnalytics) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <div className="flex min-h-[60vh] max-w-3xl items-center justify-center">
          <Card className="w-full border-dashed border-border/60 bg-muted/20 p-6 text-center">
            <h2 className="text-lg font-semibold text-foreground">
              Rejection analytics unavailable
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This feature is currently disabled. Reach out to your admin if you need access.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/app/dashboard">Back to dashboard</Link>
            </Button>
          </Card>
        </div>
      </OpsPageShell>
    );
  }

  return <OpsRejectionDashboard />;
}
