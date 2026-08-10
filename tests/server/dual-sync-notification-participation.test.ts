import { describe, expect, it, vi } from 'vitest';

import {
  disableGoogleUpdateParticipation,
  enableGoogleUpdateParticipation,
  GoogleNotificationTopicConflictError,
} from '@/server/dual-sync/notifications/participation';

const FENCE = {
  restaurantId: 'rest-1',
  externalProfileRowId: 'profile-row-1',
  externalAccountId: 'account-1',
  externalProfileId: 'profile-1',
  externalLocationId: 'location-1',
  connectionGeneration: 2,
  consentEpoch: 3,
} as const;

describe('account-scoped Google notification participation', () => {
  it('adds the managed event type while preserving unrelated account types', async () => {
    // Given
    const provider = {
      read: vi.fn(async () => ({ topic: 'projects/p/topics/managed', eventTypes: ['NEW_REVIEW'] })),
      write: vi.fn(async () => undefined),
    };
    const registry = { attach: vi.fn(async () => ({ refCount: 2 })), detach: vi.fn() };

    // When
    const result = await enableGoogleUpdateParticipation({
      fence: FENCE,
      managedTopic: 'projects/p/topics/managed',
      provider,
      registry,
    });

    // Then
    expect(provider.write).toHaveBeenCalledWith({
      accountId: 'account-1',
      topic: 'projects/p/topics/managed',
      eventTypes: ['GOOGLE_UPDATE', 'NEW_REVIEW'],
    });
    expect(registry.attach).toHaveBeenCalledWith(FENCE);
    expect(result.refCount).toBe(2);
  });

  it('rejects a topic conflict before changing provider or registry state', async () => {
    // Given
    const provider = {
      read: vi.fn(async () => ({
        topic: 'projects/other/topics/existing',
        eventTypes: ['NEW_REVIEW'],
      })),
      write: vi.fn(),
    };
    const registry = { attach: vi.fn(), detach: vi.fn() };

    // When
    const action = enableGoogleUpdateParticipation({
      fence: FENCE,
      managedTopic: 'projects/p/topics/managed',
      provider,
      registry,
    });

    // Then
    await expect(action).rejects.toBeInstanceOf(GoogleNotificationTopicConflictError);
    expect(provider.write).not.toHaveBeenCalled();
    expect(registry.attach).not.toHaveBeenCalled();
  });

  it('removes only the managed type when the final restaurant leaves', async () => {
    // Given
    const provider = {
      read: vi.fn(async () => ({
        topic: 'projects/p/topics/managed',
        eventTypes: ['GOOGLE_UPDATE', 'NEW_REVIEW'],
      })),
      write: vi.fn(async () => undefined),
    };
    const registry = { attach: vi.fn(), detach: vi.fn(async () => ({ refCount: 0 })) };

    // When
    await disableGoogleUpdateParticipation({
      fence: FENCE,
      managedTopic: 'projects/p/topics/managed',
      provider,
      registry,
    });

    // Then
    expect(provider.write).toHaveBeenCalledWith({
      accountId: 'account-1',
      topic: 'projects/p/topics/managed',
      eventTypes: ['NEW_REVIEW'],
    });
    expect(registry.detach).toHaveBeenCalledWith(FENCE);
  });
});
