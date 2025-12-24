import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
    generateAccessToken,
    validateAccessToken,
    validateToken,
    isValidTokenFormat,
    mapTokenErrorToStatus,
    mapTokenErrorToMessage,
    type AccessTokenError,
} from '../../../server/bookings/access-token';

describe('access-token', () => {
    const testBookingId = '123e4567-e89b-12d3-a456-426614174000';

    beforeEach(() => {
        // Set up test environment
        process.env.NODE_ENV = 'test';
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('generateAccessToken', () => {
        it('creates a token with correct format', () => {
            const token = generateAccessToken(testBookingId);

            // Should have v2 prefix
            expect(token.startsWith('v2.')).toBe(true);

            // Should have 4 parts: version, bookingId, expiry, signature
            const parts = token.split('.');
            expect(parts).toHaveLength(4);
            expect(parts[0]).toBe('v2');
            expect(parts[1]).toBe(testBookingId);
        });

        it('embeds correct expiry timestamp', () => {
            const token = generateAccessToken(testBookingId, { expiryHours: 24 });
            const parts = token.split('.');
            const expiry = parseInt(parts[2], 10);

            // Current time + 24 hours
            const expectedExpiry = Math.floor(Date.now() / 1000) + 24 * 3600;
            expect(expiry).toBe(expectedExpiry);
        });

        it('uses default expiry of 30 days', () => {
            const token = generateAccessToken(testBookingId);
            const parts = token.split('.');
            const expiry = parseInt(parts[2], 10);

            // Current time + 720 hours (30 days)
            const expectedExpiry = Math.floor(Date.now() / 1000) + 720 * 3600;
            expect(expiry).toBe(expectedExpiry);
        });

        it('produces URL-safe tokens', () => {
            const token = generateAccessToken(testBookingId);

            // Should not contain URL-unsafe characters
            expect(token).not.toMatch(/[+/=]/);

            // Should be valid for URL use
            expect(encodeURIComponent(token)).toBe(token);
        });

        it('generates different signatures for different booking IDs', () => {
            const token1 = generateAccessToken('11111111-1111-1111-1111-111111111111');
            const token2 = generateAccessToken('22222222-2222-2222-2222-222222222222');

            const sig1 = token1.split('.')[3];
            const sig2 = token2.split('.')[3];

            expect(sig1).not.toBe(sig2);
        });

        it('generates different signatures for different expiry times', () => {
            const token1 = generateAccessToken(testBookingId, { expiryHours: 1 });
            const token2 = generateAccessToken(testBookingId, { expiryHours: 48 });

            const sig1 = token1.split('.')[3];
            const sig2 = token2.split('.')[3];

            expect(sig1).not.toBe(sig2);
        });
    });

    describe('validateAccessToken', () => {
        it('accepts valid token for matching booking', () => {
            const token = generateAccessToken(testBookingId);
            const result = validateAccessToken(token, testBookingId);

            expect(result.valid).toBe(true);
            if (result.valid) {
                expect(result.bookingId).toBe(testBookingId);
                expect(result.expiresAt).toBeInstanceOf(Date);
            }
        });

        it('rejects token for wrong booking ID', () => {
            const token = generateAccessToken(testBookingId);
            const wrongBookingId = '99999999-9999-9999-9999-999999999999';
            const result = validateAccessToken(token, wrongBookingId);

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('BOOKING_MISMATCH');
            }
        });

        it('rejects expired token', () => {
            // Generate token that expires in 1 hour
            const token = generateAccessToken(testBookingId, { expiryHours: 1 });

            // Advance time by 2 hours
            vi.advanceTimersByTime(2 * 60 * 60 * 1000);

            const result = validateAccessToken(token, testBookingId);

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('EXPIRED');
            }
        });

        it('rejects tampered signature', () => {
            const token = generateAccessToken(testBookingId);
            const parts = token.split('.');

            // Tamper with the signature
            parts[3] = 'tampered_signature_value';
            const tamperedToken = parts.join('.');

            const result = validateAccessToken(tamperedToken, testBookingId);

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('SIGNATURE_INVALID');
            }
        });

        it('rejects tampered expiry', () => {
            const token = generateAccessToken(testBookingId, { expiryHours: 1 });
            const parts = token.split('.');

            // Try to extend expiry (signature won't match)
            const farFutureExpiry = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
            parts[2] = String(farFutureExpiry);
            const tamperedToken = parts.join('.');

            const result = validateAccessToken(tamperedToken, testBookingId);

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('SIGNATURE_INVALID');
            }
        });

        it('rejects tampered booking ID in token', () => {
            const token = generateAccessToken(testBookingId);
            const parts = token.split('.');

            // Change booking ID in token (but validate against original)
            parts[1] = '99999999-9999-9999-9999-999999999999';
            const tamperedToken = parts.join('.');

            const result = validateAccessToken(tamperedToken, testBookingId);

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('BOOKING_MISMATCH');
            }
        });

        it('rejects malformed tokens', () => {
            const malformedTokens = [
                '',
                'not-a-token',
                'v2.only-two-parts',
                'v2.id.expiry',
                'v1.wrong.version.sig',
            ];

            for (const token of malformedTokens) {
                const result = validateAccessToken(token, testBookingId);
                expect(result.valid).toBe(false);
            }
        });

        it('returns correct expiry date', () => {
            const expiryHours = 48;
            const token = generateAccessToken(testBookingId, { expiryHours });
            const result = validateAccessToken(token, testBookingId);

            expect(result.valid).toBe(true);
            if (result.valid) {
                const expectedExpiry = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
                expect(result.expiresAt.getTime()).toBe(expectedExpiry.getTime());
            }
        });
    });

    describe('isValidTokenFormat', () => {
        it('accepts valid HMAC tokens', () => {
            const token = generateAccessToken(testBookingId);
            expect(isValidTokenFormat(token)).toBe(true);
        });

        it('rejects legacy random tokens', () => {
            const legacyToken = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';
            expect(isValidTokenFormat(legacyToken)).toBe(false);
        });

        it('rejects tokens without v2 prefix', () => {
            const invalidTokens = [
                'randombase64urlstring',
                '1234567890abcdefghij',
                'no-version-prefix-here',
                'v1.wrong.version.sig',
            ];

            for (const token of invalidTokens) {
                expect(isValidTokenFormat(token)).toBe(false);
            }
        });

        it('rejects tokens with wrong number of parts', () => {
            expect(isValidTokenFormat('v2.one.two')).toBe(false);
            expect(isValidTokenFormat('v2.one')).toBe(false);
            expect(isValidTokenFormat('v2')).toBe(false);
        });
    });

    describe('validateToken (unified)', () => {
        it('validates HMAC tokens', () => {
            const token = generateAccessToken(testBookingId);
            const result = validateToken(token, testBookingId);
            expect(result.valid).toBe(true);
        });

        it('rejects legacy tokens with INVALID_TOKEN error', () => {
            const legacyToken = 'random-legacy-token-string';
            const result = validateToken(legacyToken, testBookingId);

            expect(result.valid).toBe(false);
            if (!result.valid) {
                expect(result.error).toBe('INVALID_TOKEN');
            }
        });
    });

    describe('mapTokenErrorToStatus', () => {
        it('maps expired errors to 410', () => {
            expect(mapTokenErrorToStatus('EXPIRED')).toBe(410);
        });

        it('maps mismatch errors to 403', () => {
            expect(mapTokenErrorToStatus('BOOKING_MISMATCH')).toBe(403);
        });

        it('maps invalid token errors to 401', () => {
            expect(mapTokenErrorToStatus('INVALID_FORMAT')).toBe(401);
            expect(mapTokenErrorToStatus('INVALID_TOKEN')).toBe(401);
            expect(mapTokenErrorToStatus('SIGNATURE_INVALID')).toBe(401);
        });
    });

    describe('mapTokenErrorToMessage', () => {
        const errorCodes: AccessTokenError[] = [
            'INVALID_FORMAT',
            'INVALID_TOKEN',
            'SIGNATURE_INVALID',
            'EXPIRED',
            'BOOKING_MISMATCH',
        ];

        it('returns non-empty messages for all error types', () => {
            for (const code of errorCodes) {
                const message = mapTokenErrorToMessage(code);
                expect(message).toBeTruthy();
                expect(typeof message).toBe('string');
                expect(message.length).toBeGreaterThan(10);
            }
        });

        it('returns user-friendly expiry message', () => {
            const message = mapTokenErrorToMessage('EXPIRED');
            expect(message.toLowerCase()).toContain('expired');
        });

        it('returns user-friendly mismatch message', () => {
            const message = mapTokenErrorToMessage('BOOKING_MISMATCH');
            expect(message.toLowerCase()).toContain('not valid');
        });

        it('suggests signing in for invalid tokens', () => {
            const message = mapTokenErrorToMessage('INVALID_TOKEN');
            expect(message.toLowerCase()).toContain('sign in');
        });
    });
});
