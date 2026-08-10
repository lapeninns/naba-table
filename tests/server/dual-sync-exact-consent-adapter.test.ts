import { beforeEach, describe, expect, it, vi } from 'vitest';

const readRuntime = vi.hoisted(() => vi.fn());
const buildPlan = vi.hoisted(() => vi.fn());
const getLinked = vi.hoisted(() => vi.fn());
const patchLocation = vi.hoisted(() => vi.fn());
const replaceFoodMenus = vi.hoisted(() => vi.fn());
const getFoodMenus = vi.hoisted(() => vi.fn());
const prepareFoodMenus = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/planner-runtime', () => ({
  readPublishPlannerRuntime: readRuntime,
}));
vi.mock('@/server/dual-sync/publish/planner', () => ({ buildPublishPlan: buildPlan }));
vi.mock('@/server/google-business-profile/serviceLinkedLocationRuntime', () => ({
  getLinkedExternalProfileWithLocation: getLinked,
}));
vi.mock('@/server/google-business-profile/mutationClients', () => ({
  GoogleWritePreDispatchError: class GoogleWritePreDispatchError extends Error {
    readonly name = 'GoogleWritePreDispatchError';
  },
  createGoogleListingMutationClient: () => ({ patchLocation }),
  createGoogleFoodMenusMutationClient: () => ({ replace: replaceFoodMenus }),
  isGoogleWritePreDispatchError: (failure: unknown) =>
    failure instanceof Error && failure.name === 'GoogleWritePreDispatchError',
}));
vi.mock('@/server/google-business-profile/client', () => ({
  buildGoogleBusinessProfileFoodMenusName: (account: string, location: string) =>
    `accounts/${account}/locations/${location}/foodMenus`,
  getGoogleBusinessProfileFoodMenus: getFoodMenus,
}));
vi.mock('@/server/google-business-profile/food-menus-projection-service', () => ({
  prepareFoodMenusProjection: prepareFoodMenus,
}));

import { buildSupportedExactConsentPlan } from '@/server/dual-sync/publish/exact-consent/adapter';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import { GoogleWritePreDispatchError } from '@/server/google-business-profile/mutationClients';
import { GoogleWriteOutcomeUnknownError } from '@/server/google-business-profile/writePermit';

const NOW = new Date('2026-08-09T10:00:00.000Z');
const decision = {
  fieldKey: 'profile.businessDescription',
  sectionKey: 'profile' as const,
  action: 'export_to_google' as const,
  pinnedCoreHash: 'core-field',
  pinnedGbpHash: 'google-field',
};

describe('supported exact-consent adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readRuntime.mockResolvedValue({
      coreSnapshot: { profile: { businessDescription: 'new', address: null } },
      gbpSnapshot: { profile: { businessDescription: 'old', storefrontAddress: null } },
      coreSnapshotHash: 'a'.repeat(64),
      gbpSnapshotHash: 'b'.repeat(64),
    });
    buildPlan.mockResolvedValue({
      groups: [
        {
          groupId: 'export_to_google:profile:location.profile',
          direction: 'export_to_google',
          sectionKey: 'profile',
          writeGroup: 'location.profile',
          fields: [decision],
          riskLevel: 'medium',
          destructiveWritePossible: false,
        },
      ],
      rejected: [],
      warnings: [],
    });
    getLinked.mockResolvedValue({
      accessToken: 'redacted-token',
      externalProfile: {
        id: '00000000-0000-4000-8000-000000000002',
        external_account_id: 'account-1',
        external_profile_id: 'profile-1',
        external_location_id: 'location-1',
        connection_generation: 2,
        consent_epoch: 3,
      },
    });
    patchLocation.mockResolvedValue({ name: 'locations/location-1' });
    replaceFoodMenus.mockResolvedValue({
      name: 'accounts/account-1/locations/location-1/foodMenus',
    });
  });

  it('renders preview without a mutation and dispatches that exact request only with a permit', async () => {
    const built = await buildSupportedExactConsentPlan({
      client: {} as never,
      publish: {
        restaurantId: '00000000-0000-4000-8000-000000000001',
        decisions: [decision],
        actorUserId: '00000000-0000-4000-8000-000000000003',
        pinnedCoreSnapshotHash: 'a'.repeat(64),
        pinnedGbpSnapshotHash: 'b'.repeat(64),
      },
      clock: () => NOW,
    });

    expect(patchLocation).not.toHaveBeenCalled();
    expect(built.preview.groups[0]).toMatchObject({
      writeGroup: 'location.profile',
      updateMasks: ['profile'],
      resource: 'locations/location-1',
    });
    const permit = { binding: {} } as never;
    await built.executeImmediate([permit]);
    expect(patchLocation).toHaveBeenCalledTimes(1);
    expect(patchLocation).toHaveBeenCalledWith({
      permit,
      locationId: 'location-1',
      updateMasks: ['profile'],
      payload: { profile: { description: 'new' } },
    });
  });

  it('blocks unsupported fields before linking or provider access', async () => {
    buildPlan.mockResolvedValue({
      groups: [
        {
          groupId: 'unsupported',
          direction: 'export_to_google',
          sectionKey: 'profile',
          writeGroup: 'location.profile',
          fields: [{ ...decision, fieldKey: 'profile.name' }],
        },
      ],
      rejected: [],
      warnings: [],
    });
    await expect(
      buildSupportedExactConsentPlan({
        client: {} as never,
        publish: { restaurantId: 'rest-1', decisions: [{ ...decision, fieldKey: 'profile.name' }] },
      }),
    ).rejects.toMatchObject({ code: 'GBP_EXACT_CONSENT_UNSUPPORTED_PLAN' });
    expect(getLinked).not.toHaveBeenCalled();
    expect(patchLocation).not.toHaveBeenCalled();
  });

  it('marks a permit bundle mismatch as a detectable pre-dispatch failure', async () => {
    const built = await buildSupportedExactConsentPlan({
      client: {} as never,
      publish: { restaurantId: 'rest-1', decisions: [decision] },
      clock: () => NOW,
    });

    await expect(built.executeImmediate([])).rejects.toMatchObject({
      code: 'GBP_PREFLIGHT_UNAVAILABLE',
      phase: 'provider_before_dispatch',
    });
    expect(patchLocation).not.toHaveBeenCalled();
  });

  it('marks a listing timeout as unknown only after the permit-aware mutation dispatch rejects', async () => {
    patchLocation.mockRejectedValueOnce(new GoogleWriteOutcomeUnknownError());
    const built = await buildSupportedExactConsentPlan({
      client: {} as never,
      publish: { restaurantId: 'rest-1', decisions: [decision] },
      clock: () => NOW,
    });

    await expect(built.executeImmediate([{ binding: {} } as never])).rejects.toMatchObject({
      code: 'GBP_OUTCOME_UNKNOWN',
      phase: 'provider_after_dispatch',
    });
    expect(patchLocation).toHaveBeenCalledTimes(1);
  });

  it('does not infer an unknown write outcome from a generic provider timeout', async () => {
    const providerFailure = new GoogleBusinessProfileError('private provider detail', {
      kind: 'timeout',
    });
    patchLocation.mockRejectedValueOnce(providerFailure);
    const built = await buildSupportedExactConsentPlan({
      client: {} as never,
      publish: { restaurantId: 'rest-1', decisions: [decision] },
      clock: () => NOW,
    });

    await expect(built.executeImmediate([{ binding: {} } as never])).rejects.toBe(providerFailure);
    expect(patchLocation).toHaveBeenCalledTimes(1);
  });

  it('marks a known provider pre-dispatch failure for claimed-bundle cancellation', async () => {
    replaceFoodMenus.mockRejectedValueOnce(new GoogleWritePreDispatchError());
    const menuDecision = {
      ...decision,
      fieldKey: 'foodMenus.items.dinner/item-1',
      sectionKey: 'foodMenus' as const,
    };
    buildPlan.mockResolvedValue({
      groups: [
        {
          groupId: 'export_to_google:foodMenus:location.foodMenus',
          direction: 'export_to_google',
          sectionKey: 'foodMenus',
          writeGroup: 'location.foodMenus',
          fields: [menuDecision],
          riskLevel: 'critical',
          destructiveWritePossible: true,
        },
      ],
      rejected: [],
      warnings: [],
    });
    prepareFoodMenus.mockResolvedValue({
      projection: {
        foodMenus: { name: 'accounts/account-1/locations/location-1/foodMenus', menus: [] },
      },
      projectionHash: 'c'.repeat(64),
    });
    getFoodMenus.mockResolvedValue({
      name: 'accounts/account-1/locations/location-1/foodMenus',
      menus: [],
    });
    const built = await buildSupportedExactConsentPlan({
      client: {} as never,
      publish: { restaurantId: 'rest-1', decisions: [menuDecision], actorUserId: 'user-1' },
      clock: () => NOW,
    });

    await expect(built.executeImmediate([{ binding: {} } as never])).rejects.toMatchObject({
      code: 'GBP_PREFLIGHT_UNAVAILABLE',
      phase: 'provider_before_dispatch',
    });
  });

  it('renders FoodMenus as a destructive full-resource menus replacement without persisting preview content', async () => {
    const menuDecision = {
      ...decision,
      fieldKey: 'foodMenus.items.dinner/item-1',
      sectionKey: 'foodMenus' as const,
    };
    buildPlan.mockResolvedValue({
      groups: [
        {
          groupId: 'export_to_google:foodMenus:location.foodMenus',
          direction: 'export_to_google',
          sectionKey: 'foodMenus',
          writeGroup: 'location.foodMenus',
          fields: [menuDecision],
          riskLevel: 'critical',
          destructiveWritePossible: true,
        },
      ],
      rejected: [],
      warnings: [{ message: 'Full replacement.' }],
    });
    prepareFoodMenus.mockResolvedValue({
      projection: {
        foodMenus: { name: 'accounts/account-1/locations/location-1/foodMenus', menus: [] },
      },
      projectionHash: 'c'.repeat(64),
    });
    getFoodMenus.mockResolvedValue({
      name: 'accounts/account-1/locations/location-1/foodMenus',
      menus: [{ labels: [] }],
    });

    const built = await buildSupportedExactConsentPlan({
      client: {} as never,
      publish: { restaurantId: 'rest-1', decisions: [menuDecision], actorUserId: 'user-1' },
      clock: () => NOW,
    });

    expect(prepareFoodMenus).toHaveBeenCalledWith(expect.objectContaining({ persist: false }));
    expect(replaceFoodMenus).not.toHaveBeenCalled();
    expect(built.preview.groups[0]).toMatchObject({
      fullReplacement: true,
      updateMasks: ['menus'],
      method: 'PATCH',
      resource: 'accounts/account-1/locations/location-1/foodMenus',
    });
    const permit = { binding: {} } as never;
    await built.executeImmediate([permit]);
    expect(replaceFoodMenus).toHaveBeenCalledTimes(1);
    expect(replaceFoodMenus).toHaveBeenCalledWith(
      expect.objectContaining({
        permit,
        payload: { name: 'accounts/account-1/locations/location-1/foodMenus', menus: [] },
      }),
    );
  });
});
