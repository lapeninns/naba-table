import { notFound } from 'next/navigation';

import { OpsBookingDialogDevHarness } from './ui/OpsBookingDialogDevHarness';

export const metadata = {
  title: 'Dev: Ops booking dialog',
};

export default function OpsBookingDialogDevPage() {
  // This page is only for local UI verification via Chrome DevTools MCP.
  // It must not be reachable in production/staging environments.
  // Next dev does not reliably expose NODE_ENV/APP_ENV as runtime env vars (they can be absent),
  // so we gate on Vercel deployment indicators instead.
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    notFound();
  }

  return <OpsBookingDialogDevHarness />;
}
