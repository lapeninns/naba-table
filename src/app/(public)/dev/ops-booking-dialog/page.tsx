import { notFound } from 'next/navigation';

import { OpsBookingDialogDevHarness } from './ui/OpsBookingDialogDevHarness';

export const metadata = {
  title: 'Dev: Ops booking dialog',
};

export default function OpsBookingDialogDevPage() {
  // This page is only for local UI verification via Chrome DevTools MCP.
  // It must not be reachable in production/staging environments.
  //
  // NOTE: In the Next.js App Router, route segments starting with "_" are ignored.
  // This is intentionally placed under `/dev/...` (no underscore prefix) so it is routable.
  const appEnv = process.env.APP_ENV;
  const isNonDevEnv = Boolean(appEnv && appEnv !== 'development') || process.env.NODE_ENV === 'production';
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  if (isVercel || isNonDevEnv) {
    notFound();
  }

  return <OpsBookingDialogDevHarness />;
}
