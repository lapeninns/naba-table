import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { validateGoogleBusinessProfileIdToken } from '@/server/google-business-profile/clientIdentity';
import {
  createGoogleJsonTransport,
  GoogleProviderError,
} from '@/server/google-business-profile/clientTransport';
import {
  createCredentialEnvelope,
  decryptCredentialEnvelope,
  rotateCredentialBatch,
} from '@/server/google-business-profile/credentialEnvelope';
import { normalizeGoogleUpdateMasks } from '@/server/google-business-profile/googleUpdates';
import { createGoogleNotificationAdministrationClient } from '@/server/google-business-profile/notificationClient';
import {
  claimGoogleWritePermit,
  executeGoogleWrite,
  hashGoogleRequest,
  type GoogleWritePermitBinding,
} from '@/server/google-business-profile/writePermit';

const textSchema = z.object({ value: z.string() }).strict();

describe('Wave 1C provider foundations', () => {
  it('rejects a caller-supplied protected header before dispatch', async () => {
    const fetch = vi.fn();
    const transport = createGoogleJsonTransport({
      origin: 'https://mybusinessbusinessinformation.googleapis.com',
      accessToken: 'secret-token',
      fetch,
    });

    await expect(
      transport.request('resource', textSchema, {
        headers: { Authorization: 'attacker' },
      }),
    ).rejects.toMatchObject({ code: 'GBP_PROTECTED_HEADER_OVERRIDE' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, '0'])('caps a streamed response with content-length %s', async (length) => {
    const chunk = new Uint8Array(600_000);
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(chunk);
            controller.enqueue(chunk);
            controller.close();
          },
        }),
        { headers: length === undefined ? undefined : { 'Content-Length': length } },
      ),
    );
    const transport = createGoogleJsonTransport({
      origin: 'https://mybusinessbusinessinformation.googleapis.com',
      accessToken: 'secret-token',
      fetch,
    });

    await expect(transport.request('resource', textSchema)).rejects.toMatchObject({
      code: 'GBP_MALFORMED_RESPONSE',
    });
  });

  it('rejects malformed JSON and schema-invalid JSON at the response boundary', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('{'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 12 })));
    const transport = createGoogleJsonTransport({
      origin: 'https://mybusinessbusinessinformation.googleapis.com',
      accessToken: 'secret-token',
      fetch,
    });

    await expect(transport.request('resource', textSchema)).rejects.toMatchObject({
      code: 'GBP_MALFORMED_RESPONSE',
    });
    await expect(transport.request('resource', textSchema)).rejects.toMatchObject({
      code: 'GBP_MALFORMED_RESPONSE',
    });
  });

  it('applies the outer deadline while a response body is stalled', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"value":"'));
            },
          }),
        ),
      );
      const transport = createGoogleJsonTransport({
        origin: 'https://mybusinessbusinessinformation.googleapis.com',
        accessToken: 'secret-token',
        fetch,
      });
      const request = transport.request('resource', textSchema);
      const rejection = expect(request).rejects.toMatchObject({
        code: 'GBP_TIMEOUT',
        kind: 'timeout',
      });

      await vi.advanceTimersByTimeAsync(15_000);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('never retries mutations', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    const transport = createGoogleJsonTransport({
      origin: 'https://mybusinessbusinessinformation.googleapis.com',
      accessToken: 'secret-token',
      fetch,
    });

    await expect(
      transport.request('resource', textSchema, { method: 'PATCH', json: { value: 'x' } }),
    ).rejects.toBeInstanceOf(GoogleProviderError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not shorten Retry-After beyond the retry ceiling', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '6' } }));
    const sleep = vi.fn();
    const transport = createGoogleJsonTransport({
      origin: 'https://mybusinessbusinessinformation.googleapis.com',
      accessToken: 'secret-token',
      fetch,
      sleep,
      random: () => 0,
    });

    await expect(transport.request('resource', textSchema)).rejects.toMatchObject({
      kind: 'quota',
      upstreamStatus: 429,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a GET at most twice for retryable network failures', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    const transport = createGoogleJsonTransport({
      origin: 'https://mybusinessbusinessinformation.googleapis.com',
      accessToken: 'secret-token',
      fetch,
      sleep: async () => undefined,
      random: () => 0,
    });

    await expect(transport.request('resource', textSchema)).rejects.toMatchObject({
      kind: 'upstream',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('binds credential envelopes to profile and column AAD', () => {
    const key = randomBytes(32);
    const keyring = { activeKeyId: 'primary', keys: new Map([['primary', key]]) };
    const encrypted = createCredentialEnvelope('refresh-secret', {
      keyring,
      externalProfileId: 'profile-1',
      column: 'refresh_token_encrypted',
    });

    expect(encrypted.startsWith('gbp.1.primary.')).toBe(true);
    expect(
      decryptCredentialEnvelope(encrypted, {
        keyring,
        externalProfileId: 'profile-1',
        column: 'refresh_token_encrypted',
      }).plaintext,
    ).toBe('refresh-secret');
    expect(() =>
      decryptCredentialEnvelope(encrypted, {
        keyring,
        externalProfileId: 'profile-2',
        column: 'refresh_token_encrypted',
      }),
    ).toThrow();
  });

  it('keeps rotation dry-run-first and caps a batch at 100', async () => {
    const oldKey = randomBytes(32);
    const activeKey = randomBytes(32);
    const oldKeyring = { activeKeyId: 'old', keys: new Map([['old', oldKey]]) };
    const keyring = {
      activeKeyId: 'active',
      keys: new Map([
        ['old', oldKey],
        ['active', activeKey],
      ]),
    };
    const candidates = Array.from({ length: 101 }, (_, index) => {
      const context = {
        keyring,
        externalProfileId: `profile-${index}`,
        column: 'refresh_token_encrypted',
      };
      return {
        id: `credential-${index}`,
        envelope: createCredentialEnvelope('secret', { ...context, keyring: oldKeyring }),
        context,
        compareAndSwap: vi.fn().mockResolvedValue(true),
      };
    });

    const census = await rotateCredentialBatch(candidates, { dryRun: true });
    expect(census).toEqual({ examined: 100, oldKeyCount: 100, rewrapped: 0, conflicts: 0 });
    expect(candidates.every((candidate) => candidate.compareAndSwap.mock.calls.length === 0)).toBe(
      true,
    );
  });

  it('normalizes known masks and fails all on an unknown provider path', () => {
    expect(normalizeGoogleUpdateMasks(['profile.description', 'title'])).toEqual({
      kind: 'known',
      masks: ['profile.description', 'title'],
    });
    expect(normalizeGoogleUpdateMasks(['futureGoogleField.child'])).toEqual({
      kind: 'unknown',
      masks: [],
      unknownPaths: ['futureGoogleField.child'],
    });
  });

  it('uses stable request hashes for canonical JSON', () => {
    const first = createHash('sha256').update('{"a":1,"b":2}').digest('hex');
    const second = createHash('sha256').update('{"a":1,"b":2}').digest('hex');
    expect(first).toBe(second);
  });

  it('rejects a missing OIDC ID token before identity persistence', async () => {
    await expect(
      validateGoogleBusinessProfileIdToken({
        idToken: null,
        expectedNonce: 'nonce-1',
        clientId: 'client-1',
      }),
    ).rejects.toMatchObject({ code: 'GBP_OIDC_IDENTITY_INVALID' });
  });

  it('dispatches a matching permit before the provider and finalizes consumed', async () => {
    const events: string[] = [];
    const payload = { title: 'New title' };
    const binding: GoogleWritePermitBinding = {
      restaurantId: '11111111-1111-4111-8111-111111111111',
      externalProfileRowId: '22222222-2222-4222-8222-222222222222',
      accountId: 'account-1',
      profileId: 'profile-1',
      locationId: 'location-1',
      connectionGeneration: 2,
      consentEpoch: 3,
      bundleId: '33333333-3333-4333-8333-333333333333',
      executionId: '44444444-4444-4444-8444-444444444444',
      grantId: '55555555-5555-4555-8555-555555555555',
      groupId: 'profile',
      bundleOrder: 1,
      bundleSize: 1,
      method: 'PATCH',
      resource: 'locations/location-1',
      updateMasks: ['title'],
      requestHash: hashGoogleRequest(payload),
    };
    const store = {
      claim: vi.fn().mockResolvedValue([
        {
          actor_user_id: '66666666-6666-4666-8666-666666666666',
          after_hashes: ['a'.repeat(64)],
          before_hashes: ['a'.repeat(64)],
          bundle_hash: 'a'.repeat(64),
          bundle_order: 1,
          bundle_size: 1,
          claimed_at: '2026-08-09T12:00:00.000Z',
          core_snapshot_hash: 'a'.repeat(64),
          created_at: '2026-08-09T12:00:00.000Z',
          decision_hash: 'a'.repeat(64),
          direction: 'export_to_google',
          dispatched_at: null,
          expires_at: '2026-08-09T12:15:00.000Z',
          field_keys: ['title'],
          google_snapshot_hash: 'a'.repeat(64),
          id: binding.grantId,
          issued_at: '2026-08-09T12:00:00.000Z',
          manifest_hash: 'a'.repeat(64),
          policy_version: 'policy-1',
          preview_fingerprint: 'a'.repeat(64),
          provider: 'google_business_profile',
          reason_code: null,
          renderer_version: 'renderer-1',
          restaurant_id: binding.restaurantId,
          external_profile_row_id: binding.externalProfileRowId,
          external_account_id: binding.accountId,
          external_profile_id: binding.profileId,
          external_location_id: binding.locationId,
          connection_generation: binding.connectionGeneration,
          consent_epoch: binding.consentEpoch,
          bundle_id: binding.bundleId,
          execution_id: binding.executionId,
          request_hash: binding.requestHash,
          google_method: binding.method,
          google_resource: binding.resource,
          group_id: binding.groupId,
          risk_acknowledgements: ['external_write'],
          terminal_at: null,
          update_masks: ['title'],
          update_masks_hash: 'a'.repeat(64),
          write_group: 'title',
          status: 'claimed',
        },
      ]),
      dispatch: vi.fn().mockImplementation(async () => {
        events.push('rpc-dispatch');
      }),
      finalize: vi.fn().mockImplementation(async () => {
        events.push('rpc-finalize');
      }),
    };
    const [permit] = await claimGoogleWritePermit([binding], store);
    if (!permit) throw new Error('fixture must issue one permit');

    await executeGoogleWrite({
      permit,
      method: 'PATCH',
      resource: binding.resource,
      updateMasks: ['title'],
      payload,
      dispatch: async () => {
        events.push('network');
        return 'ok';
      },
    });

    expect(events).toEqual(['rpc-dispatch', 'network', 'rpc-finalize']);
    expect(store.finalize).toHaveBeenCalledWith(binding, 'consumed', 'provider_succeeded');

    await expect(
      executeGoogleWrite({
        permit,
        method: 'PATCH',
        resource: binding.resource,
        updateMasks: ['title'],
        payload,
        dispatch: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'GBP_WRITE_PERMIT_REPLAYED' });

    const [mismatchedPermit] = await claimGoogleWritePermit([binding], store);
    if (!mismatchedPermit) throw new Error('fixture must issue one permit');
    await expect(
      executeGoogleWrite({
        permit: mismatchedPermit,
        method: 'PATCH',
        resource: binding.resource,
        updateMasks: ['title'],
        payload: { title: 'Tampered' },
        dispatch: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'GBP_WRITE_PERMIT_REQUEST_MISMATCH' });

    const [rejectedPermit] = await claimGoogleWritePermit([binding], store);
    if (!rejectedPermit) throw new Error('fixture must issue one permit');
    await expect(
      executeGoogleWrite({
        permit: rejectedPermit,
        method: 'PATCH',
        resource: binding.resource,
        updateMasks: ['title'],
        payload,
        dispatch: async () => {
          throw new GoogleProviderError('rejected', {
            code: 'GBP_UPSTREAM',
            status: 502,
            upstreamStatus: 400,
          });
        },
      }),
    ).rejects.toThrow('rejected');
    expect(store.finalize).toHaveBeenLastCalledWith(
      binding,
      'failed',
      'provider_definitive_rejection',
    );

    const [ambiguousPermit] = await claimGoogleWritePermit([binding], store);
    if (!ambiguousPermit) throw new Error('fixture must issue one permit');
    await expect(
      executeGoogleWrite({
        permit: ambiguousPermit,
        method: 'PATCH',
        resource: binding.resource,
        updateMasks: ['title'],
        payload,
        dispatch: async () => {
          throw new TypeError('network reset');
        },
      }),
    ).rejects.toMatchObject({
      name: 'GoogleWriteOutcomeUnknownError',
      code: 'GBP_WRITE_OUTCOME_UNKNOWN',
    });
    expect(store.finalize).toHaveBeenLastCalledWith(
      binding,
      'outcome_unknown',
      'provider_outcome_unknown',
    );
  });

  it('rejects a conflicting notification topic without overwriting settings', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pubsubTopic: 'projects/other/topics/managed',
          notificationTypes: ['NEW_REVIEW'],
        }),
      ),
    );
    const client = createGoogleNotificationAdministrationClient({
      accessToken: 'secret-token',
      dependencies: { fetch },
    });

    await expect(
      client.update({
        accountId: 'account-1',
        managedTopic: 'projects/nabatable/topics/gbp',
        managedNotificationTypes: ['GOOGLE_UPDATE'],
      }),
    ).rejects.toMatchObject({ code: 'GBP_NOTIFICATION_TOPIC_CONFLICT' });
    expect(client.mutationScope).toBe('account_administration');
    expect(client.requiresListingWritePermit).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
