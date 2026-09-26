import { HttpError } from '@/lib/http/errors';

import { STEP_PATHS } from './onboardingWizardDomain';

import type { OnboardingRequirement, OnboardingStep } from './types';

/**
 * Ops dashboard entry from the root host. `src/proxy.ts` redirects `/app/*` to the app
 * host's `/dashboard` in multi-host mode and serves `/app/dashboard` on a single host.
 */
export const OPS_DASHBOARD_PATH = '/app/dashboard';

/**
 * Leaves the wizard for the ops dashboard with a full page load: the dashboard may be on
 * another host, and the ops layout must read the new membership and restaurant cookie.
 */
export function navigateToOpsDashboard() {
  // Absolute URL: `src/proxy.ts` then redirects to the app host when it is separate.
  window.location.assign(new URL(OPS_DASHBOARD_PATH, window.location.origin).toString());
}

export const REQUIREMENT_STEPS: Record<
  OnboardingRequirement,
  { label: string; step: OnboardingStep; href: string }
> = {
  operating_hours: { label: 'Add your opening hours', step: 3, href: STEP_PATHS[3] },
  service_periods: { label: 'Add at least one service period', step: 4, href: STEP_PATHS[4] },
  tables: { label: 'Add at least one table', step: 5, href: STEP_PATHS[5] },
};

function isRequirement(value: unknown): value is OnboardingRequirement {
  return value === 'operating_hours' || value === 'service_periods' || value === 'tables';
}

/** The missing requirements from a 409 ONBOARDING_INCOMPLETE, or null for other errors. */
export function getMissingRequirements(error: unknown): OnboardingRequirement[] | null {
  if (!(error instanceof HttpError) || error.code !== 'ONBOARDING_INCOMPLETE') {
    return null;
  }
  const details = error.details;
  const missing =
    typeof details === 'object' && details !== null && 'missing' in details
      ? (details as { missing: unknown }).missing
      : null;
  if (!Array.isArray(missing)) {
    return [];
  }
  return missing.filter(isRequirement);
}
