import { errors } from 'jose';
import { describe, expect, it, vi } from 'vitest';

import {
  handleGoogleBusinessProfilePush,
  parseGoogleBusinessProfilePush,
  verifyGooglePubsubBearer,
} from '@/server/dual-sync/pubsub';

const CONFIG = {
  enabled: true,
  expectedAudience: 'https://ops.example.test/api/webhooks/google-business-profile/pubsub',
  pushServiceAccountEmail: 'push@example-project.iam.gserviceaccount.com',
  subscription: 'projects/example-project/subscriptions/gbp-updates',
} as const;

function pushRequest(
  payload: unknown,
  overrides: { readonly subscription?: string } = {},
): Request {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return new Request(CONFIG.expectedAudience, {
    method: 'POST',
    headers: { authorization: 'Bearer signed-token', 'content-type': 'application/json' },
    body: JSON.stringify({
      message: { data, messageId: 'message-1', publishTime: '2026-08-09T10:00:00Z' },
      subscription: overrides.subscription ?? CONFIG.subscription,
    }),
  });
}

describe('Google Business Profile Pub/Sub authentication', () => {
  it('requires RS256, a Google issuer, the exact audience, and exact verified service account', async () => {
    // Given
    const verify = vi.fn(async () => ({
      payload: { email: CONFIG.pushServiceAccountEmail, email_verified: true },
    }));

    // When
    const result = await verifyGooglePubsubBearer('Bearer signed-token', CONFIG, verify);

    // Then
    expect(result).toEqual({ ok: true });
    expect(verify).toHaveBeenCalledWith('signed-token', expect.any(Function), {
      algorithms: ['RS256'],
      audience: CONFIG.expectedAudience,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      requiredClaims: ['aud', 'exp', 'iss'],
    });
  });

  it('rejects a different service account even when the token signature is valid', async () => {
    // Given
    const verify = vi.fn(async () => ({
      payload: { email: 'attacker@example-project.iam.gserviceaccount.com', email_verified: true },
    }));

    // When
    const result = await verifyGooglePubsubBearer('Bearer signed-token', CONFIG, verify);

    // Then
    expect(result).toEqual({ ok: false, reason: 'identity_mismatch' });
  });

  it('classifies verified JWT audience or issuer failures as claim mismatch', async () => {
    // Given
    const verify = vi.fn(async () => {
      throw new errors.JWTClaimValidationFailed('unexpected audience', {}, 'aud', 'check_failed');
    });

    // When
    const result = await verifyGooglePubsubBearer('Bearer signed-token', CONFIG, verify);

    // Then
    expect(result).toEqual({ ok: false, reason: 'claim_mismatch' });
  });
});

describe('Google Business Profile Pub/Sub parsing', () => {
  it('extracts only metadata needed to enqueue a supported Google update', async () => {
    // Given
    const request = pushRequest({
      type: 'GOOGLE_UPDATE',
      accountName: 'accounts/account-1',
      locationName: 'locations/location-1',
      title: 'content must not escape the parser',
    });

    // When
    const parsed = await parseGoogleBusinessProfilePush(request, CONFIG.subscription);

    // Then
    expect(parsed).toMatchObject({
      kind: 'supported',
      messageId: 'message-1',
      eventType: 'GOOGLE_UPDATE',
      externalAccountId: 'account-1',
      externalLocationId: 'location-1',
    });
    expect(JSON.stringify(parsed)).not.toContain('content must not escape');
  });

  it('acknowledges unsupported and malformed decoded notifications as metadata-only poison', async () => {
    // Given
    const unsupported = pushRequest({ type: 'NEW_REVIEW', locationName: 'locations/location-1' });
    const malformed = pushRequest({ title: 'provider content' });

    // When
    const results = await Promise.all([
      parseGoogleBusinessProfilePush(unsupported, CONFIG.subscription),
      parseGoogleBusinessProfilePush(malformed, CONFIG.subscription),
    ]);

    // Then
    expect(results.map((result) => result.kind)).toEqual(['ignored', 'ignored']);
    expect(JSON.stringify(results)).not.toContain('provider content');
  });
});

describe('Google Business Profile Pub/Sub HTTP behavior', () => {
  it('returns 204 for accepted, duplicate, ignored, and unmatched authenticated deliveries', async () => {
    // Given
    const outcomes = ['accepted', 'duplicate', 'ignored', 'unmatched'] as const;

    // When
    const statuses = await Promise.all(
      outcomes.map(async (outcome) => {
        const response = await handleGoogleBusinessProfilePush(
          pushRequest({
            type: 'GOOGLE_UPDATE',
            accountName: 'accounts/account-1',
            locationName: 'locations/location-1',
          }),
          CONFIG,
          {
            authenticate: vi.fn(async () => ({ ok: true })),
            persist: vi.fn(async () => ({ outcome })),
          },
        );
        return response.status;
      }),
    );

    // Then
    expect(statuses).toEqual([204, 204, 204, 204]);
  });

  it('passes the exact subscription and metadata-only delivery to the atomic persistence port', async () => {
    // Given
    const persist = vi.fn(async () => ({ outcome: 'accepted' as const }));

    // When
    const response = await handleGoogleBusinessProfilePush(
      pushRequest({
        type: 'GOOGLE_UPDATE',
        accountName: 'accounts/account-1',
        locationName: 'locations/location-1',
        title: 'provider content must not reach persistence',
      }),
      CONFIG,
      { authenticate: vi.fn(async () => ({ ok: true })), persist },
    );

    // Then
    expect(response.status).toBe(204);
    expect(persist).toHaveBeenCalledWith({
      subscription: CONFIG.subscription,
      delivery: expect.objectContaining({
        kind: 'supported',
        messageId: 'message-1',
        eventType: 'GOOGLE_UPDATE',
        externalAccountId: 'account-1',
        externalLocationId: 'location-1',
      }),
    });
    expect(JSON.stringify(persist.mock.calls)).not.toContain('provider content');
  });

  it('rejects a wrong subscription before persistence', async () => {
    // Given
    const persist = vi.fn();

    // When
    const response = await handleGoogleBusinessProfilePush(
      pushRequest(
        { type: 'GOOGLE_UPDATE' },
        {
          subscription: 'projects/example-project/subscriptions/attacker',
        },
      ),
      CONFIG,
      { authenticate: vi.fn(async () => ({ ok: true })), persist },
    );

    // Then
    expect(response.status).toBe(403);
    expect(persist).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
  });

  it('rejects unauthenticated and oversized requests without reading or persisting content', async () => {
    // Given
    const persist = vi.fn();
    const oversized = new Request(CONFIG.expectedAudience, {
      method: 'POST',
      headers: { authorization: 'Bearer signed-token', 'content-length': '65537' },
      body: '{}',
    });

    // When
    const unauthorized = await handleGoogleBusinessProfilePush(pushRequest({}), CONFIG, {
      authenticate: vi.fn(async () => ({ ok: false, reason: 'invalid_token' })),
      persist,
    });
    const tooLarge = await handleGoogleBusinessProfilePush(oversized, CONFIG, {
      authenticate: vi.fn(async () => ({ ok: true })),
      persist,
    });

    // Then
    expect([unauthorized.status, tooLarge.status]).toEqual([401, 413]);
    expect(persist).not.toHaveBeenCalled();
  });

  it('distinguishes invalid tokens, verified identity mismatch, and transient persistence', async () => {
    // Given
    const request = () =>
      pushRequest({
        type: 'GOOGLE_UPDATE',
        accountName: 'accounts/account-1',
        locationName: 'locations/location-1',
      });

    // When
    const invalid = await handleGoogleBusinessProfilePush(request(), CONFIG, {
      authenticate: vi.fn(async () => ({ ok: false, reason: 'invalid_token' })),
      persist: vi.fn(),
    });
    const mismatch = await handleGoogleBusinessProfilePush(request(), CONFIG, {
      authenticate: vi.fn(async () => ({ ok: false, reason: 'identity_mismatch' })),
      persist: vi.fn(),
    });
    const claimMismatch = await handleGoogleBusinessProfilePush(request(), CONFIG, {
      authenticate: vi.fn(async () => ({ ok: false, reason: 'claim_mismatch' })),
      persist: vi.fn(),
    });
    const transient = await handleGoogleBusinessProfilePush(request(), CONFIG, {
      authenticate: vi.fn(async () => ({ ok: true })),
      persist: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    });

    // Then
    expect([invalid.status, mismatch.status, claimMismatch.status, transient.status]).toEqual([
      401, 403, 403, 500,
    ]);
  });

  it('rejects an actual oversized body and acknowledges persisted poison metadata', async () => {
    // Given
    const persist = vi.fn(async () => ({ outcome: 'ignored' as const }));
    const oversized = new Request(CONFIG.expectedAudience, {
      method: 'POST',
      headers: { authorization: 'Bearer signed-token' },
      body: 'x'.repeat(65_537),
    });
    const poison = new Request(CONFIG.expectedAudience, {
      method: 'POST',
      headers: { authorization: 'Bearer signed-token' },
      body: JSON.stringify({
        message: {
          data: Buffer.from('{invalid-json', 'utf8').toString('base64'),
          messageId: 'poison-1',
        },
        subscription: CONFIG.subscription,
      }),
    });

    // When
    const tooLarge = await handleGoogleBusinessProfilePush(oversized, CONFIG, {
      authenticate: vi.fn(async () => ({ ok: true })),
      persist,
    });
    const acknowledged = await handleGoogleBusinessProfilePush(poison, CONFIG, {
      authenticate: vi.fn(async () => ({ ok: true })),
      persist,
    });

    // Then
    expect([tooLarge.status, acknowledged.status]).toEqual([413, 204]);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({
      subscription: CONFIG.subscription,
      delivery: expect.objectContaining({
        kind: 'ignored',
        messageId: 'poison-1',
        reason: 'malformed_notification',
      }),
    });
  });

  it('acknowledges an authenticated malformed envelope without exposing a 400 retry class', async () => {
    // Given
    const malformed = new Request(CONFIG.expectedAudience, {
      method: 'POST',
      headers: { authorization: 'Bearer signed-token' },
      body: '{invalid-json',
    });

    // When
    const response = await handleGoogleBusinessProfilePush(malformed, CONFIG, {
      authenticate: vi.fn(async () => ({ ok: true })),
      persist: vi.fn(),
    });

    // Then
    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
  });
});
