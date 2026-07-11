import { beforeEach, describe, expect, it, vi } from 'vitest';

const applySuggestedPatchMock = vi.hoisted(() => vi.fn());
const createItemFromPatchMock = vi.hoisted(() => vi.fn());
const decideMissingLocalItemMock = vi.hoisted(() => vi.fn());
const claimDecisionMock = vi.hoisted(() => vi.fn());
const markDecisionFailedMock = vi.hoisted(() => vi.fn());
const markDecisionMock = vi.hoisted(() => vi.fn());
const readSettingsMock = vi.hoisted(() => vi.fn());
const readReviewMock = vi.hoisted(() => vi.fn());
const upsertSettingsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/food-menus-canonical-adapter', () => ({
  applyCanonicalFoodMenusSuggestedPatch: applySuggestedPatchMock,
  createCanonicalFoodMenusItemFromPatch: createItemFromPatchMock,
  decideCanonicalMissingLocalFoodMenusItem: decideMissingLocalItemMock,
}));

vi.mock('@/server/google-business-profile/food-menus-storage', () => ({
  claimFoodMenusImportReviewDecision: claimDecisionMock,
  markFoodMenusImportReviewDecisionFailed: markDecisionFailedMock,
  markFoodMenusImportReviewDecision: markDecisionMock,
  readFoodMenuSettings: readSettingsMock,
  readFoodMenusImportReviewForRestaurant: readReviewMock,
  upsertFoodMenuSettings: upsertSettingsMock,
}));

import { decideFoodMenusImportReview } from '@/server/google-business-profile/food-menus-import-decisions';

const client = { db: 'client' } as never;

type ReviewOverrides = Record<string, unknown>;

function review(overrides: ReviewOverrides = {}) {
  return {
    id: 'review-1',
    restaurantId: 'rest-1',
    googleSnapshotId: 'snap-google',
    projectionSnapshotId: 'snap-projection',
    localItemId: 'item-1',
    externalItemId: 'ext-1',
    targetKind: 'food',
    googlePath: 'menus[0].sections[0].items[0]',
    googleSectionLabel: 'Mains',
    googleItemName: 'Momo',
    matchStatus: 'matched',
    matchConfidence: 'section_name',
    suggestedPatch: { itemName: 'Momo', basePrice: 8.5 },
    warnings: [],
    decisionStatus: 'pending',
    decisionAction: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as never;
}

function decide(overrides: {
  review?: ReviewOverrides;
  action?: string;
  decidedByUserId?: string | null;
} = {}) {
  readReviewMock.mockResolvedValue(review(overrides.review));
  return decideFoodMenusImportReview({
    client,
    restaurantId: 'rest-1',
    reviewId: 'review-1',
    action: (overrides.action ?? 'apply_to_nabatable') as never,
    ...(overrides.decidedByUserId !== undefined
      ? { decidedByUserId: overrides.decidedByUserId }
      : {}),
  });
}

beforeEach(() => {
  for (const mock of [
    applySuggestedPatchMock,
    createItemFromPatchMock,
    decideMissingLocalItemMock,
    claimDecisionMock,
    markDecisionFailedMock,
    markDecisionMock,
    readSettingsMock,
    readReviewMock,
    upsertSettingsMock,
  ]) {
    mock.mockReset();
  }
  claimDecisionMock.mockResolvedValue(review());
  markDecisionMock.mockImplementation(async (input: { decisionStatus: string; decisionAction: string }) =>
    review({ decisionStatus: input.decisionStatus, decisionAction: input.decisionAction }),
  );
  markDecisionFailedMock.mockResolvedValue(review({ decisionStatus: 'failed' }));
  readSettingsMock.mockResolvedValue(null);
});

describe('decideFoodMenusImportReview', () => {
  it('rejects decisions for unknown reviews without claiming anything @contract @security', async () => {
    readReviewMock.mockResolvedValue(null);

    await expect(
      decideFoodMenusImportReview({
        client,
        restaurantId: 'rest-1',
        reviewId: 'missing-review',
        action: 'ignore_google_change',
      }),
    ).rejects.toMatchObject({ name: 'GBP_FOOD_MENUS_REVIEW_NOT_FOUND' });

    expect(readReviewMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      reviewId: 'missing-review',
    });
    expect(claimDecisionMock).not.toHaveBeenCalled();
  });

  it('rejects reviews that were already decided @contract', async () => {
    await expect(
      decide({ review: { decisionStatus: 'applied' }, action: 'ignore_google_change' }),
    ).rejects.toMatchObject({ name: 'GBP_FOOD_MENUS_REVIEW_ALREADY_DECIDED' });
    expect(claimDecisionMock).not.toHaveBeenCalled();
  });

  it('marks ignored google changes without touching items or settings @contract', async () => {
    const result = await decide({ action: 'ignore_google_change', decidedByUserId: 'user-7' });

    expect(claimDecisionMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionAction: 'ignore_google_change',
      decidedByUserId: 'user-7',
    });
    expect(markDecisionMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionStatus: 'ignored',
      decisionAction: 'ignore_google_change',
      decidedByUserId: 'user-7',
    });
    expect(result.item).toBeNull();
    expect(upsertSettingsMock).not.toHaveBeenCalled();
    expect(applySuggestedPatchMock).not.toHaveBeenCalled();
  });

  it('merges menu metadata patches over current settings when applying metadata @contract', async () => {
    readSettingsMock.mockResolvedValue({
      restaurantId: 'rest-1',
      menuLabel: 'Old label',
      sourceUrl: 'https://old.example/menu',
      cuisines: ['NEPALESE'],
      languageCode: 'en-GB',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });

    const result = await decide({
      review: {
        matchStatus: 'menu_metadata',
        suggestedPatch: { menuLabel: '  Dinner Menu  ', sourceUrl: null },
      },
      action: 'apply_menu_metadata',
    });

    // Patched keys win; untouched keys fall back to current settings.
    expect(upsertSettingsMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      menuLabel: 'Dinner Menu',
      sourceUrl: null,
      cuisines: ['NEPALESE'],
      languageCode: 'en-GB',
    });
    expect(markDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ decisionStatus: 'applied', decisionAction: 'apply_menu_metadata' }),
    );
    expect(result.item).toBeNull();
  });

  it('rejects metadata decisions on non-metadata reviews before claiming @contract', async () => {
    await expect(
      decide({ review: { matchStatus: 'matched' }, action: 'apply_menu_metadata' }),
    ).rejects.toMatchObject({ name: 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE' });

    expect(claimDecisionMock).not.toHaveBeenCalled();
    expect(upsertSettingsMock).not.toHaveBeenCalled();
    expect(markDecisionFailedMock).not.toHaveBeenCalled();
  });

  it('routes missing-local-item actions to the canonical adapter @contract', async () => {
    const soldOutItem = { id: 'item-1', availabilityStatus: 'sold_out' };
    decideMissingLocalItemMock.mockResolvedValue(soldOutItem);

    const result = await decide({
      review: { matchStatus: 'missing_from_google', localItemId: 'item-1' },
      action: 'mark_sold_out',
    });

    expect(decideMissingLocalItemMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      localItemId: 'item-1',
      action: 'mark_sold_out',
      reviewId: 'review-1',
    });
    expect(markDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ decisionStatus: 'applied', decisionAction: 'mark_sold_out' }),
    );
    expect(result.item).toBe(soldOutItem);
  });

  it('rejects missing-local-item actions when the review is not missing_from_google @contract', async () => {
    await expect(
      decide({ review: { matchStatus: 'matched' }, action: 'mark_inactive' }),
    ).rejects.toMatchObject({ name: 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE' });
    expect(decideMissingLocalItemMock).not.toHaveBeenCalled();
    expect(claimDecisionMock).not.toHaveBeenCalled();
  });

  it('creates new items from complete unmatched suggestions @contract', async () => {
    const createdItem = { id: 'item-new', itemName: 'Sekuwa' };
    createItemFromPatchMock.mockResolvedValue(createdItem);

    const result = await decide({
      review: {
        matchStatus: 'unmatched',
        localItemId: null,
        suggestedPatch: {
          externalItemId: 'ext-9',
          itemName: 'Sekuwa',
          category: 'Grill',
          basePrice: 12,
        },
      },
      action: 'create_new_item',
    });

    expect(createItemFromPatchMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      targetKind: 'food',
      suggestedPatch: expect.objectContaining({
        externalItemId: 'ext-9',
        itemName: 'Sekuwa',
        category: 'Grill',
        basePrice: 12,
      }),
      reviewId: 'review-1',
    });
    expect(markDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ decisionStatus: 'applied', decisionAction: 'create_new_item' }),
    );
    expect(result.item).toBe(createdItem);
  });

  it('rejects create_new_item when the suggestion is missing required fields @contract', async () => {
    await expect(
      decide({
        review: {
          matchStatus: 'unmatched',
          suggestedPatch: { externalItemId: 'ext-9', itemName: 'Sekuwa', category: 'Grill' },
        },
        action: 'create_new_item',
      }),
    ).rejects.toMatchObject({ name: 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE' });
    expect(createItemFromPatchMock).not.toHaveBeenCalled();
  });

  it('applies normalised suggested patches to the matched local item @contract @security', async () => {
    const patchedItem = { id: 'item-1', itemName: 'Momo' };
    applySuggestedPatchMock.mockResolvedValue(patchedItem);

    const result = await decide({
      review: {
        suggestedPatch: {
          itemName: '  Momo  ',
          currency: 'gbp',
          basePrice: 8.5,
          subcategory: '   ',
        },
      },
      action: 'apply_to_nabatable',
    });

    // parseSuggestedPatch trims text, nulls blank optionals, and uppercases currency.
    expect(applySuggestedPatchMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      localItemId: 'item-1',
      suggestedPatch: { itemName: 'Momo', currency: 'GBP', basePrice: 8.5, subcategory: null },
      reviewId: 'review-1',
    });
    expect(markDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ decisionStatus: 'applied', decisionAction: 'apply_to_nabatable' }),
    );
    expect(result.item).toBe(patchedItem);
  });

  it('rejects apply_to_nabatable without a matched local item @contract', async () => {
    await expect(
      decide({ review: { localItemId: null }, action: 'apply_to_nabatable' }),
    ).rejects.toMatchObject({ name: 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE' });
    expect(claimDecisionMock).not.toHaveBeenCalled();
  });

  it('rejects malformed suggested patches that parse to nothing @contract', async () => {
    await expect(
      decide({ review: { suggestedPatch: { basePrice: -4, itemName: '   ' } } }),
    ).rejects.toMatchObject({ name: 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE' });
    expect(applySuggestedPatchMock).not.toHaveBeenCalled();
  });

  it('marks a claimed review failed when the side effect throws and rethrows the cause @contract', async () => {
    const writeFailure = new Error('canonical write failed');
    applySuggestedPatchMock.mockRejectedValue(writeFailure);

    await expect(decide({ action: 'apply_to_nabatable' })).rejects.toBe(writeFailure);

    expect(markDecisionFailedMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      reviewId: 'review-1',
      decisionAction: 'apply_to_nabatable',
      decidedByUserId: null,
    });
    expect(markDecisionMock).not.toHaveBeenCalled();
  });

  it('does not mark failure when the error happens before the claim @contract', async () => {
    readSettingsMock.mockRejectedValue(new Error('settings read failed'));

    await expect(
      decide({
        review: { matchStatus: 'menu_metadata', suggestedPatch: { menuLabel: 'Dinner' } },
        action: 'apply_menu_metadata',
      }),
    ).rejects.toThrow('settings read failed');

    expect(claimDecisionMock).not.toHaveBeenCalled();
    expect(markDecisionFailedMock).not.toHaveBeenCalled();
  });

  it('propagates claim conflicts without marking the review failed @contract', async () => {
    const claimConflict = new Error('review already claimed');
    claimDecisionMock.mockRejectedValue(claimConflict);

    await expect(decide({ action: 'ignore_google_change' })).rejects.toBe(claimConflict);
    expect(markDecisionFailedMock).not.toHaveBeenCalled();
  });

  it('still rethrows the original failure when marking the claim failed also fails @contract @observability', async () => {
    const writeFailure = new Error('canonical write failed');
    applySuggestedPatchMock.mockRejectedValue(writeFailure);
    markDecisionFailedMock.mockRejectedValue(new Error('mark failed error'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(decide({ action: 'apply_to_nabatable' })).rejects.toBe(writeFailure);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[gbp][food-menus][import-review] failed to mark claimed review failed',
      { reviewId: 'review-1', message: 'mark failed error' },
    );
  });
});
