import { createHmac, timingSafeEqual } from 'crypto';

import type { Tables } from '@/types/supabase';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Token version prefix for HMAC-based tokens.
 */
const TOKEN_VERSION = 'v2';

/**
 * Default expiry for access tokens (30 days in hours).
 */
const DEFAULT_EXPIRY_HOURS = 720;

/**
 * Minimum secret length for HMAC signing (32 bytes = 256 bits).
 */
const MIN_SECRET_LENGTH = 32;

/**
 * Get the secret key for HMAC signing.
 * Falls back to a development-only secret if not configured.
 */
function getTokenSecret(): string {
    const secret = process.env.BOOKING_ACCESS_TOKEN_SECRET;

    if (secret && secret.length >= MIN_SECRET_LENGTH) {
        return secret;
    }

    // Development fallback - NOT secure for production!
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        return 'dev-only-insecure-secret-do-not-use-in-production-12345678';
    }

    throw new Error(
        'BOOKING_ACCESS_TOKEN_SECRET must be set to a secure value (minimum 32 characters) in production'
    );
}

// ============================================================================
// TYPES
// ============================================================================

export type AccessTokenValidationResult =
    | { valid: true; bookingId: string; expiresAt: Date }
    | { valid: false; error: AccessTokenError };

export type AccessTokenError =
    | 'INVALID_FORMAT'
    | 'INVALID_TOKEN'
    | 'SIGNATURE_INVALID'
    | 'EXPIRED'
    | 'BOOKING_MISMATCH';

export type AccessLevel = 'owner' | 'staff' | 'token' | 'none';

export interface AccessInfo {
    level: AccessLevel;
    canModify: boolean;
    canCancel: boolean;
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generates an HMAC-based access token for a booking.
 *
 * Token format: v2.{bookingId}.{expiryTimestamp}.{signature}
 * - Version marker for detection
 * - Booking ID embedded for self-validation
 * - Expiry timestamp (Unix seconds)
 * - HMAC-SHA256 signature
 *
 * @param bookingId - UUID of the booking
 * @param options - Optional configuration
 * @returns URL-safe token string
 */
export function generateAccessToken(
    bookingId: string,
    options: { expiryHours?: number } = {}
): string {
    const expiryHours = options.expiryHours ?? DEFAULT_EXPIRY_HOURS;
    const expiryTimestamp = Math.floor(Date.now() / 1000) + expiryHours * 3600;

    const payload = `${TOKEN_VERSION}.${bookingId}.${expiryTimestamp}`;
    const signature = createHmac('sha256', getTokenSecret())
        .update(payload)
        .digest('base64url');

    return `${payload}.${signature}`;
}

/**
 * Generates a fresh token for an existing booking (e.g., for resend email).
 * Alias for generateAccessToken.
 */
export function refreshAccessToken(
    bookingId: string,
    options: { expiryHours?: number } = {}
): string {
    return generateAccessToken(bookingId, options);
}

// ============================================================================
// TOKEN VALIDATION
// ============================================================================

/**
 * Checks if a token has the valid HMAC format (v2.bookingId.expiry.signature).
 */
export function isValidTokenFormat(token: string): boolean {
    return token.startsWith(`${TOKEN_VERSION}.`) && token.split('.').length === 4;
}

/**
 * Validates an HMAC-based access token.
 *
 * @param token - The token to validate
 * @param expectedBookingId - The booking ID from the URL (must match embedded ID)
 * @returns Validation result with success or error details
 */
export function validateAccessToken(
    token: string,
    expectedBookingId: string
): AccessTokenValidationResult {
    // Check format
    if (!isValidTokenFormat(token)) {
        return { valid: false, error: 'INVALID_TOKEN' };
    }

    // Parse token parts
    const parts = token.split('.');
    const [version, bookingId, expiryStr, providedSignature] = parts;

    // Validate version
    if (version !== TOKEN_VERSION) {
        return { valid: false, error: 'INVALID_TOKEN' };
    }

    // Validate booking ID matches
    if (bookingId !== expectedBookingId) {
        return { valid: false, error: 'BOOKING_MISMATCH' };
    }

    // Validate expiry
    const expiryTimestamp = parseInt(expiryStr, 10);
    if (isNaN(expiryTimestamp)) {
        return { valid: false, error: 'INVALID_FORMAT' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (expiryTimestamp < now) {
        return { valid: false, error: 'EXPIRED' };
    }

    // Validate signature
    const payload = `${version}.${bookingId}.${expiryStr}`;
    const expectedSignature = createHmac('sha256', getTokenSecret())
        .update(payload)
        .digest('base64url');

    // Timing-safe comparison to prevent timing attacks
    try {
        const providedBuffer = Buffer.from(providedSignature, 'base64url');
        const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

        if (providedBuffer.length !== expectedBuffer.length) {
            return { valid: false, error: 'SIGNATURE_INVALID' };
        }

        if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
            return { valid: false, error: 'SIGNATURE_INVALID' };
        }
    } catch {
        return { valid: false, error: 'SIGNATURE_INVALID' };
    }

    return {
        valid: true,
        bookingId,
        expiresAt: new Date(expiryTimestamp * 1000),
    };
}

/**
 * Validates a token. Only HMAC tokens (v2.xxx.xxx.xxx) are supported.
 * Old random tokens will fail with INVALID_TOKEN.
 *
 * @param token - Token to validate
 * @param expectedBookingId - Booking ID from URL
 * @returns Validation result
 */
export function validateToken(
    token: string,
    expectedBookingId: string
): AccessTokenValidationResult {
    return validateAccessToken(token, expectedBookingId);
}

// ============================================================================
// ACCESS LEVEL DETERMINATION
// ============================================================================

/**
 * Determines the access level for a booking request.
 *
 * @param booking - The booking record
 * @param user - Authenticated user (if any)
 * @param tokenResult - Token validation result (if token provided)
 * @returns Access information
 */
export function determineAccessLevel(
    booking: Tables<'bookings'>,
    user: { id: string; email?: string | null } | null,
    tokenResult: AccessTokenValidationResult | null
): AccessInfo {
    // Priority 1: Authenticated owner (email matches)
    if (user?.email && booking.customer_email) {
        const userEmail = user.email.toLowerCase().trim();
        const bookingEmail = booking.customer_email.toLowerCase().trim();

        if (userEmail === bookingEmail) {
            return {
                level: 'owner',
                canModify: canModifyBooking(booking),
                canCancel: canCancelBooking(booking),
            };
        }
    }

    // Priority 2: Restaurant staff (checked separately via membership)
    // This is handled at the API layer, not here

    // Priority 3: Valid token
    if (tokenResult?.valid) {
        return {
            level: 'token',
            canModify: canModifyBooking(booking),
            canCancel: canCancelBooking(booking),
        };
    }

    // No access
    return {
        level: 'none',
        canModify: false,
        canCancel: false,
    };
}

/**
 * Checks if a booking can be modified based on its status.
 */
function canModifyBooking(booking: Tables<'bookings'>): boolean {
    const modifiableStatuses = ['pending', 'pending_allocation', 'confirmed'];
    return modifiableStatuses.includes(booking.status);
}

/**
 * Checks if a booking can be cancelled based on its status.
 */
function canCancelBooking(booking: Tables<'bookings'>): boolean {
    const cancellableStatuses = ['pending', 'pending_allocation', 'confirmed'];
    return cancellableStatuses.includes(booking.status);
}

// ============================================================================
// ERROR MAPPING
// ============================================================================

/**
 * Maps access token errors to HTTP status codes.
 */
export function mapTokenErrorToStatus(error: AccessTokenError): number {
    switch (error) {
        case 'EXPIRED':
            return 410; // Gone
        case 'BOOKING_MISMATCH':
            return 403; // Forbidden
        case 'INVALID_FORMAT':
        case 'INVALID_TOKEN':
        case 'SIGNATURE_INVALID':
        default:
            return 401; // Unauthorized
    }
}

/**
 * Maps access token errors to human-readable messages.
 */
export function mapTokenErrorToMessage(error: AccessTokenError): string {
    switch (error) {
        case 'EXPIRED':
            return 'This link has expired. Please sign in to view your booking.';
        case 'BOOKING_MISMATCH':
            return 'This link is not valid for this booking.';
        case 'INVALID_FORMAT':
        case 'INVALID_TOKEN':
            return 'Invalid booking link. Please sign in to view your booking.';
        case 'SIGNATURE_INVALID':
            return 'This link has been tampered with or is invalid.';
        default:
            return 'Unable to verify this link. Please sign in to view your booking.';
    }
}
