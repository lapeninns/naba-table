import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleMock = vi.hoisted(() => vi.fn());
const createPersistenceMock = vi.hoisted(() => vi.fn());
const getServiceClientMock = vi.hoisted(() => vi.fn());
const ingress = vi.hoisted(() => ({
  enabled: true,
  expectedAudience: 'https://example.test/api/webhooks/google-business-profile/pubsub' as
    | string
    | null,
  pushServiceAccountEmail: 'push@example.iam.gserviceaccount.com' as string | null,
  subscription: 'projects/example/subscriptions/gbp' as string | null,
  topic: 'projects/example/topics/gbp' as string | null,
}));

vi.mock('@/lib/env', () => ({ env: { dualSync: { pubsubIngress: ingress } } }));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: getServiceClientMock }));
vi.mock('@/server/dual-sync/pubsub', () => ({
  createSupabaseGooglePubsubPersistence: createPersistenceMock,
  handleGoogleBusinessProfilePush: handleMock,
}));

import { POST } from '@/app/api/webhooks/google-business-profile/pubsub/route';

describe('Google Business Profile Pub/Sub route', () => {
  beforeEach(() => {
    ingress.enabled = true;
    const persist = vi.fn();
    getServiceClientMock.mockReset().mockReturnValue({ service: true });
    createPersistenceMock.mockReset().mockReturnValue({ persist });
    handleMock.mockReset().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      }),
    );
  });

  it('wires the exact configured audience, identity, subscription, and atomic persistence', async () => {
    // Given
    const request = new Request(ingress.expectedAudience ?? '', { method: 'POST' });

    // When
    const response = await POST(request);

    // Then
    expect(response.status).toBe(204);
    expect(createPersistenceMock).toHaveBeenCalledWith({ service: true });
    expect(handleMock).toHaveBeenCalledWith(
      request,
      {
        enabled: true,
        expectedAudience: ingress.expectedAudience,
        pushServiceAccountEmail: ingress.pushServiceAccountEmail,
        subscription: ingress.subscription,
      },
      expect.objectContaining({ persist: expect.any(Function) }),
    );
  });

  it('fails closed with no-store when ingress is disabled', async () => {
    // Given
    ingress.enabled = false;

    // When
    const response = await POST(new Request('https://example.test', { method: 'POST' }));

    // Then
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
    expect(handleMock).not.toHaveBeenCalled();
    expect(getServiceClientMock).not.toHaveBeenCalled();
  });
});
