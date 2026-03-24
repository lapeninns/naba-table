import { notFound } from 'next/navigation';

/**
 * Dev harness routes must never be reachable in production/staging (or on Vercel).
 * This is a hard guard at the server component boundary.
 */
export function enforceDevOnly(): void {
  const appEnv = process.env.APP_ENV;
  const allowLocalDevHarness =
    process.env.NODE_ENV !== 'production' &&
    !process.env.VERCEL &&
    !process.env.VERCEL_ENV &&
    process.env.NEXT_RUNTIME !== 'edge';
  const isNonDevEnv =
    Boolean(appEnv && appEnv !== 'development') || process.env.NODE_ENV === 'production';
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

  if (allowLocalDevHarness) {
    return;
  }

  if (isVercel || isNonDevEnv) {
    notFound();
  }
}

