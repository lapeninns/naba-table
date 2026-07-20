/**
 * Raised when the database rejects the customer contact payload (NOT NULL or
 * CHECK constraint). Production's `customers` table still requires a phone
 * (`phone NOT NULL` + `customers_phone_check` length 7–20), so an email-only
 * booking cannot store a customer there until the optional-contact migration
 * is applied. Mapping this to a controlled 422 replaces the July 2026
 * INTERNAL_SERVER_ERROR cluster (46 `customers_phone_check` violations in 14
 * days) caused by inserting an empty-string phone.
 *
 * Lives in its own leaf module (rather than `server/customers.ts`) so
 * `instanceof` checks keep working in tests that `vi.mock('@/server/customers')`.
 */
export class CustomerContactStorageError extends Error {
  readonly code: 'PHONE_REQUIRED' | 'INVALID_CONTACT';

  constructor(code: 'PHONE_REQUIRED' | 'INVALID_CONTACT', message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = 'CustomerContactStorageError';
    this.code = code;
  }
}
