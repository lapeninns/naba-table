/**
 * Guest-auth design §12.21 / §5.3: `bookings.auth_user_id` binds a booking to the signed-in
 * guest who owns it. When staff change the booking's contact email, that binding no longer
 * describes the booking's owner, so the same write must clear it. Guest tokens die separately
 * through the contact fingerprint; this helper covers the account binding.
 *
 * Use it on every staff write payload that may carry `customer_email`. A payload without
 * `customer_email`, or with the same address (case and surrounding whitespace ignored), is
 * returned unchanged.
 */
export type OwnerBindingSource = {
  customer_email?: string | null;
};

/**
 * Any staff write payload. Typed as `object` rather than a weak all-optional type, so a
 * payload that does not mention the contact email (the common case) still infers its own type.
 */
export type OwnerBindingPatch = object;

function normalizeContactEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function changesBookingContactEmail(
  existing: OwnerBindingSource,
  patch: OwnerBindingPatch,
): boolean {
  if (!('customer_email' in patch) || patch.customer_email === undefined) return false;
  return (
    normalizeContactEmail(patch.customer_email) !== normalizeContactEmail(existing.customer_email)
  );
}

export function withOwnerBindingRevokedOnEmailChange<TPatch extends OwnerBindingPatch>(
  existing: OwnerBindingSource,
  patch: TPatch,
): TPatch & { auth_user_id?: null } {
  if (!changesBookingContactEmail(existing, patch)) {
    return patch;
  }
  return { ...patch, auth_user_id: null };
}
