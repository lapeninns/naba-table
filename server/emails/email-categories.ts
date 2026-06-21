// Email categories drive the transactional/marketing split for unsubscribe handling.
//
// ESSENTIAL mail is tied to an action the recipient took (a booking, a login, an
// invitation) and is always delivered unless the address is HARD-suppressed (bounce or
// spam complaint). It is exempt from unsubscribe.
//
// OPTIONAL mail (review requests, marketing) is suppressible: a one-click unsubscribe
// stops it while leaving essential mail flowing.

export type EmailCategory =
  | 'booking_confirmation'
  | 'booking_update' // modification / cancellation / rejection
  | 'booking_reminder'
  | 'auth' // magic link / sign-in
  | 'team_invitation'
  | 'operational' // ops alerts, operator template tests
  | 'review_request'
  | 'marketing';

// Only these are suppressible by a one-click unsubscribe. Everything else is essential.
const OPTIONAL_CATEGORIES: ReadonlySet<EmailCategory> = new Set<EmailCategory>([
  'review_request',
  'marketing',
]);

export function isEssentialCategory(category: EmailCategory): boolean {
  return !OPTIONAL_CATEGORIES.has(category);
}

/**
 * Default category for sends that don't declare one. Defaults to essential so a missing
 * tag can never accidentally drop transactional mail — optional mail must opt in.
 */
export const DEFAULT_EMAIL_CATEGORY: EmailCategory = 'operational';
