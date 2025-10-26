import { randomBytes } from 'crypto';

import { getServiceSupabaseClient } from '@/server/supabase';

import type { Tables } from '@/types/supabase';

/**
 * Generates a cryptographically secure confirmation token.
 * @returns Base64url-encoded token (64 characters, 32 bytes of entropy)
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

/**
 * Error thrown when token validation fails
 */
export class TokenValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'TOKEN_NOT_FOUND' | 'TOKEN_EXPIRED' | 'TOKEN_USED',
  ) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

/**
 * Validates a confirmation token and returns the associated booking.
 * Throws TokenValidationError if token is invalid, expired, or already used.
 * 
 * @param token Confirmation token to validate
 * @returns Booking record if valid
 * @throws TokenValidationError
 */
export async function validateConfirmationToken(token: string): Promise<Tables<'bookings'>> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('confirmation_token', token)
    .maybeSingle();

  if (error) {
    console.error('[confirmation-token] Database error during validation', error);
    throw error;
  }

  if (!data) {
    throw new TokenValidationError('Token not found', 'TOKEN_NOT_FOUND');
  }

  // Check if token has expired
  if (data.confirmation_token_expires_at) {
    const expiryDate = new Date(data.confirmation_token_expires_at);
    if (expiryDate < new Date()) {
      throw new TokenValidationError('Token has expired', 'TOKEN_EXPIRED');
    }
  }

  // Check if token has already been used
  if (data.confirmation_token_used_at) {
    throw new TokenValidationError('Token has already been used', 'TOKEN_USED');
  }

  return data;
}

/**
 * Marks a confirmation token as used by setting the used_at timestamp.
 * This prevents token replay attacks.
 * 
 * @param token Confirmation token to mark as used
 */
export async function markTokenUsed(token: string): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const { error } = await supabase
    .from('bookings')
    .update({ confirmation_token_used_at: new Date().toISOString() })
    .eq('confirmation_token', token);

  if (error) {
    console.error('[confirmation-token] Failed to mark token as used', error);
    throw error;
  }
}

/**
 * Updates a booking record with a confirmation token and expiry.
 * 
 * @param bookingId UUID of the booking
 * @param token Generated confirmation token
 * @param expiryTimestamp ISO-8601 expiry timestamp
 */
export async function attachTokenToBooking(
  bookingId: string,
  token: string,
  expiryTimestamp: string,
): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const { error } = await supabase
    .from('bookings')
    .update({
      confirmation_token: token,
      confirmation_token_expires_at: expiryTimestamp,
    })
    .eq('id', bookingId);

  if (error) {
    console.error('[confirmation-token] Failed to attach token to booking', error);
    throw error;
  }
}

/**
 * Sanitized booking data for public confirmation page.
 * Excludes sensitive fields and PII.
 */
export type PublicBookingConfirmation = {
  id: string;
  reference: string;
  restaurantName: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
  bookingType: string;
  seating: string;
  notes: string | null;
  status: string;
};

/**
 * Transforms a booking record into public confirmation data.
 * Removes sensitive fields like customer email/phone.
 * 
 * @param booking Full booking record from database
 * @param restaurantName Restaurant name (from join or lookup)
 * @returns Sanitized booking data safe for public display
 */
export function toPublicConfirmation(
  booking: Tables<'bookings'>,
  restaurantName: string,
): PublicBookingConfirmation {
  return {
    id: booking.id,
    reference: booking.reference,
    restaurantName,
    date: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    partySize: booking.party_size,
    bookingType: booking.booking_type,
    seating: booking.seating_preference,
    notes: booking.notes,
    status: booking.status,
  };
}
