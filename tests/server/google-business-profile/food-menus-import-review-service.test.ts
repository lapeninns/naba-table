import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getFoodMenusMock = vi.hoisted(() => vi.fn());
const listImportItemsMock = vi.hoisted(() => vi.fn());
const readSettingsMock = vi.hoisted(() => vi.fn());
const recordSnapshotMock = vi.hoisted(() => vi.fn());
const replacePendingReviewsMock = vi.hoisted(() => vi.fn());
const resolvePreviousIdentitiesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/client', () => ({
  getGoogleBusinessProfileFoodMenus: getFoodMenusMock,
}));

vi.mock('@/server/google-business-profile/food-menus-canonical-adapter', () => ({
  listCanonicalFoodMenusImportItems: listImportItemsMock,
}));

vi.mock('@/server/google-business-profile/food-menus-storage', () => ({
  readFoodMenuSettings: readSettingsMock,
  recordFoodMenusSnapshot: recordSnapshotMock,
  replacePendingFoodMenusImportReviews: replacePendingReviewsMock,
}));

vi.mock('@/server/google-business-profile/food-menus-sync-identities', () => ({
  resolvePreviousFoodMenusIdentities: resolvePreviousIdentitiesMock,
}));

import {
  canonicalizeGoogleFoodMenusResource,
  hashGoogleFoodMenusResource,
} from '@/server/google-business-profile/food-menus';
import {
  prepareFoodMenusImportReview,
  refreshFoodMenusImportReviewFromGoogle,
} from '@/server/google-business-profile/food-menus-import-review-service';

const FIXED_NOW = '2026-07-11T12:00:00.000Z';
const FOOD_MENUS_NAME = 'accounts/1/locations/2/foodMenus';

const client = { db: 'client' } as never;

const googleFoodMenus = {
  name: FOOD_MENUS_NAME,
  menus: [
    {
      labels: [{ displayName: 'Food menu' }],
      sections: [
        {
          labels: [{ displayName: 'Mains' }],
          items: [
            {
              labels: [{ displayName: 'Momo' }],
              attributes: { price: { currencyCode: 'GBP', units: '8' } },
            },
          ],
        },
      ],
    },
  ],
} as never;

const reviewRows = [{ id: 'review-row-1' }];

function prepare(overrides: Record<string, unknown> = {}) {
  return prepareFoodMenusImportReview({
    client,
    restaurantId: 'rest-1',
    googleFoodMenus,
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
  for (const mock of [
    getFoodMenusMock,
    listImportItemsMock,
    readSettingsMock,
    recordSnapshotMock,
    replacePendingReviewsMock,
    resolvePreviousIdentitiesMock,
  ]) {
    mock.mockReset();
  }
  getFoodMenusMock.mockResolvedValue(googleFoodMenus);
  listImportItemsMock.mockResolvedValue([]);
  readSettingsMock.mockResolvedValue(null);
  recordSnapshotMock.mockResolvedValue({ id: 'snap-google-1' });
  replacePendingReviewsMock.mockResolvedValue(reviewRows);
  resolvePreviousIdentitiesMock.mockResolvedValue({
    identities: [],
    projectionSnapshotId: 'snap-projection-resolved',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('prepareFoodMenusImportReview', () => {
  it('builds the review from real domain matching, records a snapshot, and replaces pending rows @contract @security', async () => {
    const prepared = await prepare({ createdByUserId: 'user-3' });

    expect(listImportItemsMock).toHaveBeenCalledWith('rest-1', client);
    expect(readSettingsMock).toHaveBeenCalledWith({ client, restaurantId: 'rest-1' });
    expect(resolvePreviousIdentitiesMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      projectionSnapshotId: undefined,
      previousIdentities: undefined,
    });

    expect(recordSnapshotMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      externalProfileId: null,
      snapshotKind: 'google_pull',
      source: 'manual',
      foodMenusName: FOOD_MENUS_NAME,
      rawFoodMenus: googleFoodMenus,
      canonicalFoodMenus: canonicalizeGoogleFoodMenusResource(googleFoodMenus),
      snapshotHash: hashGoogleFoodMenusResource(googleFoodMenus),
      pulledAt: FIXED_NOW,
      createdByUserId: 'user-3',
    });
    expect(replacePendingReviewsMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      googleSnapshotId: 'snap-google-1',
      projectionSnapshotId: 'snap-projection-resolved',
      review: prepared.review,
    });

    // With no local items, the single Google item surfaces as unmatched.
    const unmatched = prepared.review.items.find((item) => item.match.status === 'unmatched');
    expect(unmatched).toBeDefined();
    expect(unmatched?.googleItemName).toBe('Momo');
    expect(unmatched?.googlePath).toBe('menus[0].sections[0].items[0]');

    expect(prepared.localItemCount).toBe(0);
    expect(prepared.previousIdentityCount).toBe(0);
    expect(prepared.projectionSnapshotId).toBe('snap-projection-resolved');
    expect(prepared.googleSnapshot).toEqual({ id: 'snap-google-1' });
    expect(prepared.rows).toBe(reviewRows);
  });

  it('skips all persistence when persist is false @contract', async () => {
    const prepared = await prepare({ persist: false });

    expect(recordSnapshotMock).not.toHaveBeenCalled();
    expect(replacePendingReviewsMock).not.toHaveBeenCalled();
    expect(prepared.googleSnapshot).toBeNull();
    expect(prepared.rows).toEqual([]);
    expect(prepared.review.items.length).toBeGreaterThan(0);
  });

  it('reuses a caller-provided google snapshot id instead of recording a new one @contract', async () => {
    const prepared = await prepare({ googleSnapshotId: 'snap-existing' });

    expect(recordSnapshotMock).not.toHaveBeenCalled();
    expect(replacePendingReviewsMock).toHaveBeenCalledWith(
      expect.objectContaining({ googleSnapshotId: 'snap-existing' }),
    );
    expect(prepared.googleSnapshot).toBeNull();
  });

  it('handles a malformed Google payload with no menus as an empty review @contract @external-mock', async () => {
    const malformed = { name: FOOD_MENUS_NAME } as never;

    const prepared = await prepare({ googleFoodMenus: malformed });

    expect(prepared.review.items).toEqual([]);
    expect(prepared.review.localItemsMissingFromGoogle).toEqual([]);
    expect(recordSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotHash: hashGoogleFoodMenusResource(malformed),
        canonicalFoodMenus: expect.objectContaining({ menus: [] }),
      }),
    );
  });

  it('forwards the snapshot source and explicit previous identities @contract', async () => {
    const previousIdentities = [
      {
        stableKey: 'menu.0.section.0.item.ext-1',
        localItemId: 'item-1',
        externalItemId: 'ext-1',
        itemName: 'Momo',
        sectionKey: 'mains',
        sectionLabel: 'Mains',
        googlePath: 'menus[0].sections[0].items[0]',
        googleOptionPaths: [],
      },
    ] as never;
    resolvePreviousIdentitiesMock.mockResolvedValue({
      identities: previousIdentities,
      projectionSnapshotId: 'snap-projection-9',
    });

    const prepared = await prepare({
      source: 'scheduled',
      previousIdentities,
      projectionSnapshotId: 'snap-projection-9',
    });

    expect(recordSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'scheduled' }),
    );
    expect(resolvePreviousIdentitiesMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      projectionSnapshotId: 'snap-projection-9',
      previousIdentities,
    });
    expect(prepared.previousIdentityCount).toBe(1);
  });

  it('propagates storage failures from the pending-review replacement @contract', async () => {
    const storageFailure = new Error('replace_pending_food_menus_import_reviews failed');
    replacePendingReviewsMock.mockRejectedValue(storageFailure);

    await expect(prepare()).rejects.toBe(storageFailure);
  });
});

describe('refreshFoodMenusImportReviewFromGoogle', () => {
  it('pulls Google food menus with the name/menus read mask and reuses the prepare flow @contract @external-mock', async () => {
    const refreshed = await refreshFoodMenusImportReviewFromGoogle({
      client,
      restaurantId: 'rest-1',
      accessToken: 'token-1',
      foodMenusName: FOOD_MENUS_NAME,
    } as never);

    expect(getFoodMenusMock).toHaveBeenCalledWith('token-1', FOOD_MENUS_NAME, {
      readMask: ['name', 'menus'],
    });
    expect(refreshed.googleFoodMenus).toBe(googleFoodMenus);
    expect(refreshed.googleFoodMenusHash).toBe(hashGoogleFoodMenusResource(googleFoodMenus));
    expect(refreshed.importReview.rows).toBe(reviewRows);
    expect(recordSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('propagates provider auth failures without writing snapshots or reviews @contract @external-mock', async () => {
    const providerFailure = Object.assign(new Error('Google authorization failed'), {
      name: 'GoogleBusinessProfileError',
      code: 'GBP_FORBIDDEN',
      status: 409,
    });
    getFoodMenusMock.mockRejectedValue(providerFailure);

    await expect(
      refreshFoodMenusImportReviewFromGoogle({
        client,
        restaurantId: 'rest-1',
        accessToken: 'token-1',
        foodMenusName: FOOD_MENUS_NAME,
      } as never),
    ).rejects.toBe(providerFailure);

    expect(recordSnapshotMock).not.toHaveBeenCalled();
    expect(replacePendingReviewsMock).not.toHaveBeenCalled();
  });

  it('passes persist=false through to the prepare flow @contract @external-mock', async () => {
    const refreshed = await refreshFoodMenusImportReviewFromGoogle({
      client,
      restaurantId: 'rest-1',
      accessToken: 'token-1',
      foodMenusName: FOOD_MENUS_NAME,
      persist: false,
    } as never);

    expect(recordSnapshotMock).not.toHaveBeenCalled();
    expect(replacePendingReviewsMock).not.toHaveBeenCalled();
    expect(refreshed.importReview.rows).toEqual([]);
  });
});
