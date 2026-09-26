import { randomBytes } from 'crypto';

export const CONFIRMATION_TOKEN_BASE64URL_LENGTH = 43;
export const LEGACY_CONFIRMATION_TOKEN_LENGTH = 64;

/**
 * Generates a cryptographically secure confirmation token.
 * @returns Base64url-encoded token (43 characters, 32 bytes of entropy)
 */
export function generateConfirmationToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Computes the expiry timestamp for a confirmation token.
 * @param hours Number of hours until expiry (default: 1)
 * @returns ISO-8601 timestamp
 */
export function computeTokenExpiry(hours = 1): string {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry.toISOString();
}
