import { notFound } from 'next/navigation';

import { OpsFloorPlanDevHarness } from '../../__dev/ops-floor-plan/ui/OpsFloorPlanDevHarness';

export const metadata = {
  title: 'Dev: Ops floor plan',
};

export default function OpsFloorPlanDevPage() {
  // Dev-only UI harness (auth-free). Must not be reachable in deployments.
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV) {
    notFound();
  }

  return <OpsFloorPlanDevHarness />;
}
