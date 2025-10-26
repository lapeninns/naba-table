import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  generateConfirmationToken,
  computeTokenExpiry,
  validateConfirmationToken,
  markTokenUsed,
  TokenValidationError,
  toPublicConfirmation,
} from '@/server/bookings/confirmation-token';

let mockSupabase: {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => mockSupabase,
}));

describe('generateConfirmationToken', () => {
  it('should generate a 43-character token', () => {
    const token = generateConfirmationToken();
    expect(token).toHaveLength(43);
  });

  it('should generate unique tokens', () => {
    const token1 = generateConfirmationToken();
    const token2 = generateConfirmationToken();
    expect(token1).not.toBe(token2);
  });

  it('should generate base64url-encoded tokens', () => {
    const token = generateConfirmationToken();
    // Base64url only contains: A-Z, a-z, 0-9, -, _
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should generate tokens with high entropy', () => {
    // Generate multiple tokens and ensure they're all different
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateConfirmationToken());
    }
    expect(tokens.size).toBe(100); // All unique
  });
});

describe('computeTokenExpiry', () => {
  it('should return ISO-8601 timestamp', () => {
    const expiry = computeTokenExpiry(1);
    expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should compute expiry 1 hour from now by default', () => {
    const now = Date.now();
    const expiry = computeTokenExpiry(1);
    const expiryTime = new Date(expiry).getTime();
    const expectedExpiry = now + 60 * 60 * 1000; // 1 hour in ms

    // Allow 1 second tolerance for test execution time
    expect(expiryTime).toBeGreaterThanOrEqual(expectedExpiry - 1000);
    expect(expiryTime).toBeLessThanOrEqual(expectedExpiry + 1000);
  });

  it('should compute custom expiry times', () => {
    const now = Date.now();
    const expiry = computeTokenExpiry(2); // 2 hours
    const expiryTime = new Date(expiry).getTime();
    const expectedExpiry = now + 2 * 60 * 60 * 1000;

    expect(expiryTime).toBeGreaterThanOrEqual(expectedExpiry - 1000);
    expect(expiryTime).toBeLessThanOrEqual(expectedExpiry + 1000);
  });
});

describe('validateConfirmationToken', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  it('should return booking if token is valid', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        id: 'booking-123',
        reference: 'AB1234',
        restaurant_id: 'restaurant-123',
        confirmation_token: 'valid-token',
        confirmation_token_expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        confirmation_token_used_at: null,
      },
      error: null,
    });

    const booking = await validateConfirmationToken('valid-token');
    expect(booking).toBeDefined();
    expect(booking.id).toBe('booking-123');
  });

  it('should throw TOKEN_NOT_FOUND if token does not exist', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(validateConfirmationToken('nonexistent-token')).rejects.toThrow(
      TokenValidationError,
    );
    await expect(validateConfirmationToken('nonexistent-token')).rejects.toThrow(
      'Token not found',
    );
  });

  it('should throw TOKEN_EXPIRED if token has expired', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        id: 'booking-123',
        confirmation_token: 'expired-token',
        confirmation_token_expires_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        confirmation_token_used_at: null,
      },
      error: null,
    });

    await expect(validateConfirmationToken('expired-token')).rejects.toThrow(
      TokenValidationError,
    );
    await expect(validateConfirmationToken('expired-token')).rejects.toThrow(
      'Token has expired',
    );
  });

  it('should throw TOKEN_USED if token has already been used', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        id: 'booking-123',
        confirmation_token: 'used-token',
        confirmation_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        confirmation_token_used_at: new Date().toISOString(), // Already used
      },
      error: null,
    });

    await expect(validateConfirmationToken('used-token')).rejects.toThrow(
      TokenValidationError,
    );
    await expect(validateConfirmationToken('used-token')).rejects.toThrow(
      'Token has already been used',
    );
  });
});

describe('toPublicConfirmation', () => {
  it('should sanitize booking data for public display', () => {
    const booking = {
      id: 'booking-123',
      reference: 'AB1234',
      restaurant_id: 'restaurant-123',
      customer_id: 'customer-123',
      booking_date: '2025-01-20',
      start_time: '19:00',
      end_time: '21:00',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'indoor',
      notes: 'Window seat please',
      status: 'confirmed',
      customer_name: 'John Doe',
      customer_email: 'john@example.com', // Should be excluded
      customer_phone: '+1234567890', // Should be excluded
      idempotency_key: 'secret-key', // Should be excluded
      created_at: '2025-01-15T12:00:00Z',
    } as any;

    const publicData = toPublicConfirmation(booking, 'Test Restaurant');

    // Should include safe fields
    expect(publicData.id).toBe('booking-123');
    expect(publicData.reference).toBe('AB1234');
    expect(publicData.restaurantName).toBe('Test Restaurant');
    expect(publicData.date).toBe('2025-01-20');
    expect(publicData.startTime).toBe('19:00');
    expect(publicData.endTime).toBe('21:00');
    expect(publicData.partySize).toBe(4);
    expect(publicData.bookingType).toBe('dinner');
    expect(publicData.seating).toBe('indoor');
    expect(publicData.notes).toBe('Window seat please');
    expect(publicData.status).toBe('confirmed');

    // Should NOT include PII or sensitive fields
    expect(publicData).not.toHaveProperty('customer_email');
    expect(publicData).not.toHaveProperty('customer_phone');
    expect(publicData).not.toHaveProperty('customer_name');
    expect(publicData).not.toHaveProperty('idempotency_key');
    expect(publicData).not.toHaveProperty('customer_id');
    expect(publicData).not.toHaveProperty('restaurant_id');
  });

  it('should handle null notes', () => {
    const booking = {
      id: 'booking-123',
      reference: 'AB1234',
      booking_date: '2025-01-20',
      start_time: '19:00',
      end_time: '21:00',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'indoor',
      notes: null,
      status: 'confirmed',
    } as any;

    const publicData = toPublicConfirmation(booking, 'Test Restaurant');
    expect(publicData.notes).toBeNull();
  });
});

describe('TokenValidationError', () => {
  it('should create error with correct code and message', () => {
    const error = new TokenValidationError('Test message', 'TOKEN_NOT_FOUND');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TokenValidationError);
    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TOKEN_NOT_FOUND');
    expect(error.name).toBe('TokenValidationError');
  });

  it('should support all error codes', () => {
    const codes = ['TOKEN_NOT_FOUND', 'TOKEN_EXPIRED', 'TOKEN_USED'] as const;
    
    codes.forEach((code) => {
      const error = new TokenValidationError('Test', code);
      expect(error.code).toBe(code);
    });
  });
});
