import { notFound } from 'next/navigation';

import { OpsBookingDialogDevHarness } from '../../__dev/ops-booking-dialog/ui/OpsBookingDialogDevHarness';

export const metadata = {
  title: 'Dev: Ops booking dialog',
};

export default function OpsBookingDialogDevPage() {
  // Dev-only UI harness (auth-free). Must not be reachable in deployments.
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV) {
    notFound();
  }

  return <OpsBookingDialogDevHarness />;
}
