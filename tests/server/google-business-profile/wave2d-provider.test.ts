import { describe, expect, it, vi } from 'vitest';

import {
  createGoogleUpdatesClient,
  normalizeGoogleUpdateMasks,
} from '@/server/google-business-profile/googleUpdates';
import { createGoogleNotificationAdministrationClient } from '@/server/google-business-profile/notificationClient';

describe('Wave 2D provider participation', () => {
  it('preserves unrelated notification types without echoing response extensions', async () => {
    // Given
    let patchBody: Promise<unknown> | undefined;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'accounts/123/notificationSetting',
            pubsubTopic: 'projects/nabatable/topics/gbp',
            notificationTypes: ['NEW_REVIEW'],
            providerExtension: { content: 'must not be echoed' },
          }),
        ),
      )
      .mockImplementationOnce((request: Request) => {
        patchBody = request.clone().json();
        return Promise.resolve(
          new Response(
            JSON.stringify({
              name: 'accounts/123/notificationSetting',
              pubsubTopic: 'projects/nabatable/topics/gbp',
              notificationTypes: ['GOOGLE_UPDATE', 'NEW_REVIEW'],
            }),
          ),
        );
      });
    const client = createGoogleNotificationAdministrationClient({
      accessToken: 'token',
      dependencies: { fetch },
    });

    // When
    await client.update({
      accountId: '123',
      managedTopic: 'projects/nabatable/topics/gbp',
      managedNotificationTypes: ['GOOGLE_UPDATE'],
    });

    // Then
    expect(fetch).toHaveBeenCalledTimes(2);
    const request = fetch.mock.calls[1]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) throw new Error('fixture must receive a Request');
    expect(request.method).toBe('PATCH');
    expect(request.url).toContain('updateMask=pubsubTopic%2CnotificationTypes');
    await expect(patchBody).resolves.toEqual({
      pubsubTopic: 'projects/nabatable/topics/gbp',
      notificationTypes: ['GOOGLE_UPDATE', 'NEW_REVIEW'],
    });
  });

  it('retains exact normalized paths so ancestor and descendant overlap stays precise', () => {
    // Given / When
    const normalized = normalizeGoogleUpdateMasks([
      ' profile.description ',
      'phoneNumbers.primaryPhone',
      'profile.description',
    ]);

    // Then
    expect(normalized).toEqual({
      kind: 'known',
      masks: ['phoneNumbers.primaryPhone', 'profile.description'],
    });
  });

  it('observes location and attribute updates separately with one provider timestamp', async () => {
    // Given
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            location: { name: 'locations/location-1', title: 'Updated title' },
            diffMask: 'profile.description,title',
            pendingMask: 'phoneNumbers.primaryPhone',
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'locations/location-1/attributes',
            attributes: [{ name: 'attributes/has_delivery', values: [true] }],
          }),
        ),
      );
    const client = createGoogleUpdatesClient({
      accessToken: 'token',
      dependencies: { fetch },
      clock: () => '2026-08-09T12:00:00.000Z',
    });

    // When
    const observation = await client.observe('location-1', ['title', 'profile.description']);

    // Then
    expect(observation.observedAt).toBe('2026-08-09T12:00:00.000Z');
    expect(observation.location.diffMask).toEqual({
      kind: 'known',
      masks: ['profile.description', 'title'],
    });
    expect(observation.attributes.attributes).toEqual([
      { name: 'attributes/has_delivery', values: [true] },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    const first = fetch.mock.calls[0]?.[0];
    const second = fetch.mock.calls[1]?.[0];
    if (!(first instanceof Request) || !(second instanceof Request)) {
      throw new Error('fixtures must receive Requests');
    }
    expect(first.url).toContain(
      'v1/locations/location-1:getGoogleUpdated?readMask=profile.description%2Ctitle',
    );
    expect(second.url).toContain('v1/locations/location-1/attributes:getGoogleUpdated');
  });

  it('fails all masks when a response includes an unknown path', async () => {
    // Given
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          location: { name: 'locations/location-1' },
          diffMask: 'title,futureGoogleField.child',
          pendingMask: '',
        }),
      ),
    );
    const client = createGoogleUpdatesClient({ accessToken: 'token', dependencies: { fetch } });

    // When
    const response = await client.getLocation('location-1', ['title']);

    // Then
    expect(response.diffMask).toEqual({
      kind: 'unknown',
      masks: [],
      unknownPaths: ['futureGoogleField.child'],
    });
  });

  it('rejects a missing location read mask before provider dispatch', async () => {
    // Given
    const fetch = vi.fn();
    const client = createGoogleUpdatesClient({ accessToken: 'token', dependencies: { fetch } });

    // When
    const request = client.getLocation('location-1', []);

    // Then
    await expect(request).rejects.toMatchObject({ code: 'GBP_GOOGLE_UPDATE_READ_MASK_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reconciles an exact final event set while preserving its unrelated type and topic', async () => {
    // Given
    let patchBody: Promise<unknown> | undefined;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pubsubTopic: 'projects/nabatable/topics/gbp',
            notificationTypes: ['GOOGLE_UPDATE', 'NEW_REVIEW'],
          }),
        ),
      )
      .mockImplementationOnce((request: Request) => {
        patchBody = request.clone().json();
        return Promise.resolve(
          new Response(
            JSON.stringify({
              pubsubTopic: 'projects/nabatable/topics/gbp',
              notificationTypes: ['NEW_REVIEW'],
            }),
          ),
        );
      });
    const client = createGoogleNotificationAdministrationClient({
      accessToken: 'token',
      dependencies: { fetch },
    });

    // When
    await client.reconcile({
      accountId: '123',
      managedTopic: 'projects/nabatable/topics/gbp',
      finalNotificationTypes: ['NEW_REVIEW'],
    });

    // Then
    await expect(patchBody).resolves.toEqual({
      pubsubTopic: 'projects/nabatable/topics/gbp',
      notificationTypes: ['NEW_REVIEW'],
    });
  });

  it('clears the managed topic only with an empty final event set', async () => {
    // Given
    let patchBody: Promise<unknown> | undefined;
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pubsubTopic: 'projects/nabatable/topics/gbp',
            notificationTypes: ['GOOGLE_UPDATE'],
          }),
        ),
      )
      .mockImplementationOnce((request: Request) => {
        patchBody = request.clone().json();
        return Promise.resolve(new Response(JSON.stringify({ notificationTypes: [] })));
      });
    const client = createGoogleNotificationAdministrationClient({
      accessToken: 'token',
      dependencies: { fetch },
    });

    // When
    await client.reconcile({
      accountId: '123',
      managedTopic: null,
      finalNotificationTypes: [],
    });

    // Then
    await expect(patchBody).resolves.toEqual({ pubsubTopic: '', notificationTypes: [] });
  });
});
