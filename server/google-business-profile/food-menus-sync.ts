import {
  deleteDrinkItem,
  getDrinkItemDetail,
  listDrinkItemDetails,
  upsertDrinkItem,
} from '@/server/drinks-menu/repository';
import {
  deleteMenuItem,
  getMenuItemDetail,
  listMenuItemDetails,
  upsertMenuItem,
} from '@/server/menu/repository';
import { listRestaurantMenuHierarchy } from '@/server/menu-hierarchy/repository';

import { getGoogleBusinessProfileFoodMenus, updateGoogleBusinessProfileFoodMenus } from './client';
import {
  buildGoogleFoodMenusImportReview,
  buildCanonicalGoogleFoodMenusProjection,
  buildGoogleFoodMenusProjection,
  canonicalizeGoogleFoodMenusResource,
  hashGoogleFoodMenusResource,
  type GoogleFoodMenusImportReview,
  type GoogleFoodMenusProjectedIdentity,
  type GoogleFoodMenusProjection,
  type GoogleFoodMenusResource,
} from './food-menus';
import {
  listProjectedFoodMenusIdentities,
  markFoodMenusImportReviewDecision,
  markFoodMenusPublishAttemptRunning,
  openFoodMenusPublishAttempt,
  readLatestFoodMenusSnapshot,
  readFoodMenusImportReviewForRestaurant,
  recordFoodMenusSnapshot,
  recordFoodMenusProjection,
  finishFoodMenusPublishAttempt,
  replacePendingFoodMenusImportReviews,
  readFoodMenuSettings,
  upsertFoodMenuSettings,
  type FoodMenusImportReviewRecord,
  type FoodMenusProjectedIdentityRecord,
  type FoodMenusPublishAttempt,
  type FoodMenusPublishMode,
  type FoodMenusSnapshot,
  type FoodMenusSnapshotSource,
} from './food-menus-storage';

import type { GoogleFoodMenuCuisine } from './food-menus';
import type { DrinkItemDetail, DrinkItemUpsertInput } from '@/server/drinks-menu/types';
import type { MenuItemDetail, MenuItemUpsertInput } from '@/server/menu/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface PrepareFoodMenusProjectionInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly foodMenusName: string;
  readonly menuLabel?: string | null;
  readonly sourceUrl?: string | null;
  readonly languageCode?: string | null;
  readonly includeUnavailable?: boolean;
  readonly cuisines?: GoogleFoodMenuCuisine[];
  readonly externalProfileId?: string | null;
  readonly source?: Extract<FoodMenusSnapshotSource, 'manual' | 'scheduled' | 'preflight'>;
  readonly createdByUserId?: string | null;
  readonly persist?: boolean;
}

export interface PreparedFoodMenusProjection {
  readonly localItemCount: number;
  readonly projection: GoogleFoodMenusProjection;
  readonly projectionHash: string;
  readonly snapshot: FoodMenusSnapshot | null;
  readonly identities: ReadonlyArray<FoodMenusProjectedIdentityRecord>;
}

export interface PrepareFoodMenusImportReviewInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly googleFoodMenus: GoogleFoodMenusResource;
  readonly externalProfileId?: string | null;
  readonly source?: Extract<FoodMenusSnapshotSource, 'manual' | 'scheduled' | 'preflight'>;
  readonly googleSnapshotId?: string | null;
  readonly projectionSnapshotId?: string | null;
  readonly previousIdentities?: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
  readonly createdByUserId?: string | null;
  readonly persist?: boolean;
}

export interface PreparedFoodMenusImportReview {
  readonly localItemCount: number;
  readonly review: GoogleFoodMenusImportReview;
  readonly googleSnapshot: FoodMenusSnapshot | null;
  readonly projectionSnapshotId: string | null;
  readonly previousIdentityCount: number;
  readonly rows: ReadonlyArray<FoodMenusImportReviewRecord>;
}

export interface RefreshFoodMenusImportReviewFromGoogleInput extends Omit<
  PrepareFoodMenusImportReviewInput,
  'googleFoodMenus' | 'googleSnapshotId'
> {
  readonly accessToken: string;
  readonly foodMenusName: string;
}

export interface RefreshedFoodMenusImportReviewFromGoogle {
  readonly googleFoodMenus: GoogleFoodMenusResource;
  readonly googleFoodMenusHash: string;
  readonly importReview: PreparedFoodMenusImportReview;
}

export type FoodMenusImportReviewDecisionAction =
  | 'apply_to_nabatable'
  | 'create_new_item'
  | 'ignore_google_change'
  | 'apply_menu_metadata'
  | 'mark_inactive'
  | 'mark_sold_out'
  | 'delete_local';

export interface DecideFoodMenusImportReviewInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly reviewId: string;
  readonly action: FoodMenusImportReviewDecisionAction;
  readonly decidedByUserId?: string | null;
}

export interface DecidedFoodMenusImportReview {
  readonly review: FoodMenusImportReviewRecord;
  readonly item: MenuItemDetail | DrinkItemDetail | null;
}

export interface PublishFoodMenusProjectionInput extends Omit<
  PrepareFoodMenusProjectionInput,
  'persist' | 'source'
> {
  readonly accessToken: string;
  readonly expectedGoogleHash?: string | null;
  readonly expectedProjectionHash?: string | null;
  readonly publishMode?: Extract<FoodMenusPublishMode, 'manual' | 'scheduled'>;
}

export interface PublishedFoodMenusProjection {
  readonly projection: PreparedFoodMenusProjection;
  readonly baselineGoogleSnapshot: FoodMenusSnapshot;
  readonly baselineGoogleHash: string;
  readonly attempt: FoodMenusPublishAttempt;
  readonly googleResponse: GoogleFoodMenusResource | null;
}

export async function prepareFoodMenusProjection({
  client,
  restaurantId,
  foodMenusName,
  menuLabel,
  sourceUrl,
  languageCode,
  includeUnavailable,
  cuisines,
  externalProfileId = null,
  source = 'manual',
  createdByUserId = null,
  persist = true,
}: PrepareFoodMenusProjectionInput): Promise<PreparedFoodMenusProjection> {
  const [hierarchy, settings] = await Promise.all([
    listRestaurantMenuHierarchy(restaurantId, client),
    readFoodMenuSettings({ client, restaurantId }),
  ]);
  const canonicalPublishableMenus = hierarchy.menus.filter(
    (menu) => menu.active && (menu.menuKind === 'food' || menu.menuKind === 'mixed'),
  );
  const usesCanonicalHierarchy = canonicalPublishableMenus.length > 0;
  const items = usesCanonicalHierarchy ? [] : await listMenuItemDetails(restaurantId, client);
  const projection = usesCanonicalHierarchy
    ? buildCanonicalGoogleFoodMenusProjection({
        foodMenusName,
        menus: hierarchy.menus,
        includeUnavailable,
      })
    : buildGoogleFoodMenusProjection({
        foodMenusName,
        items,
        menuLabel: menuLabel ?? settings?.menuLabel,
        sourceUrl: sourceUrl ?? settings?.sourceUrl,
        languageCode: languageCode ?? settings?.languageCode,
        includeUnavailable,
        cuisines: cuisines ?? (settings?.cuisines as GoogleFoodMenuCuisine[] | undefined),
      });
  const projectionHash = hashGoogleFoodMenusResource(projection.foodMenus);
  const localItemCount = usesCanonicalHierarchy
    ? canonicalPublishableMenus.reduce(
        (count, menu) =>
          count +
          menu.sections.reduce((sectionCount, section) => sectionCount + section.items.length, 0),
        0,
      )
    : items.length;

  if (!persist) {
    return {
      localItemCount,
      projection,
      projectionHash,
      snapshot: null,
      identities: [],
    };
  }

  const recorded = await recordFoodMenusProjection({
    client,
    restaurantId,
    projection,
    snapshotHash: projectionHash,
    externalProfileId,
    source,
    createdByUserId,
  });

  return {
    localItemCount,
    projection,
    projectionHash,
    snapshot: recorded.snapshot,
    identities: recorded.identities,
  };
}

export async function prepareFoodMenusImportReview({
  client,
  restaurantId,
  googleFoodMenus,
  externalProfileId = null,
  source = 'manual',
  googleSnapshotId = null,
  projectionSnapshotId,
  previousIdentities,
  createdByUserId = null,
  persist = true,
}: PrepareFoodMenusImportReviewInput): Promise<PreparedFoodMenusImportReview> {
  const [items, drinkItems, settings, resolvedPrevious] = await Promise.all([
    listMenuItemDetails(restaurantId, client),
    listDrinkItemDetails(restaurantId, client),
    readFoodMenuSettings({ client, restaurantId }),
    resolvePreviousFoodMenusIdentities({
      client,
      restaurantId,
      projectionSnapshotId,
      previousIdentities,
    }),
  ]);
  const review = buildGoogleFoodMenusImportReview({
    googleFoodMenus,
    localItems: items,
    localDrinkItems: drinkItems,
    previousIdentities: resolvedPrevious.identities,
    settings: settings
      ? {
          menuLabel: settings.menuLabel,
          sourceUrl: settings.sourceUrl,
          cuisines: settings.cuisines as GoogleFoodMenuCuisine[],
          languageCode: settings.languageCode,
        }
      : null,
  });

  if (!persist) {
    return {
      localItemCount: items.length + drinkItems.length,
      review,
      googleSnapshot: null,
      projectionSnapshotId: resolvedPrevious.projectionSnapshotId,
      previousIdentityCount: resolvedPrevious.identities.length,
      rows: [],
    };
  }

  const googleSnapshot =
    googleSnapshotId === null
      ? await recordFoodMenusSnapshot({
          client,
          restaurantId,
          externalProfileId,
          snapshotKind: 'google_pull',
          source,
          foodMenusName: googleFoodMenus.name,
          rawFoodMenus: googleFoodMenus,
          canonicalFoodMenus: canonicalizeGoogleFoodMenusResource(googleFoodMenus),
          snapshotHash: hashGoogleFoodMenusResource(googleFoodMenus),
          pulledAt: new Date().toISOString(),
          createdByUserId,
        })
      : null;
  const rows = await replacePendingFoodMenusImportReviews({
    client,
    restaurantId,
    googleSnapshotId: googleSnapshot?.id ?? googleSnapshotId,
    projectionSnapshotId: resolvedPrevious.projectionSnapshotId,
    review,
  });

  return {
    localItemCount: items.length,
    review,
    googleSnapshot,
    projectionSnapshotId: resolvedPrevious.projectionSnapshotId,
    previousIdentityCount: resolvedPrevious.identities.length,
    rows,
  };
}

export async function refreshFoodMenusImportReviewFromGoogle({
  client,
  restaurantId,
  accessToken,
  foodMenusName,
  externalProfileId = null,
  source = 'manual',
  projectionSnapshotId,
  previousIdentities,
  createdByUserId = null,
  persist = true,
}: RefreshFoodMenusImportReviewFromGoogleInput): Promise<RefreshedFoodMenusImportReviewFromGoogle> {
  const googleFoodMenus = await getGoogleBusinessProfileFoodMenus(accessToken, foodMenusName, {
    readMask: ['name', 'menus'],
  });
  const importReview = await prepareFoodMenusImportReview({
    client,
    restaurantId,
    googleFoodMenus,
    externalProfileId,
    source,
    projectionSnapshotId,
    previousIdentities,
    createdByUserId,
    persist,
  });

  return {
    googleFoodMenus,
    googleFoodMenusHash: hashGoogleFoodMenusResource(googleFoodMenus),
    importReview,
  };
}

export async function decideFoodMenusImportReview({
  client,
  restaurantId,
  reviewId,
  action,
  decidedByUserId = null,
}: DecideFoodMenusImportReviewInput): Promise<DecidedFoodMenusImportReview> {
  const review = await readFoodMenusImportReviewForRestaurant({
    client,
    restaurantId,
    reviewId,
  });
  if (!review) {
    const error = new Error('FoodMenus import review was not found.');
    error.name = 'GBP_FOOD_MENUS_REVIEW_NOT_FOUND';
    throw error;
  }
  if (review.decisionStatus !== 'pending') {
    const error = new Error('FoodMenus import review has already been decided.');
    error.name = 'GBP_FOOD_MENUS_REVIEW_ALREADY_DECIDED';
    throw error;
  }

  if (action === 'ignore_google_change') {
    const decided = await markFoodMenusImportReviewDecision({
      client,
      restaurantId,
      reviewId,
      decisionStatus: 'ignored',
      decisionAction: 'ignore_google_change',
      decidedByUserId,
    });
    return { review: decided, item: null };
  }

  if (action === 'apply_menu_metadata') {
    const metadataPatch = parseMenuMetadataPatch(review.suggestedPatch);
    if (review.matchStatus !== 'menu_metadata' || !metadataPatch) {
      const error = new Error('FoodMenus import review does not contain menu metadata.');
      error.name = 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE';
      throw error;
    }
    const currentSettings = await readFoodMenuSettings({ client, restaurantId });
    await upsertFoodMenuSettings({
      client,
      restaurantId,
      menuLabel: hasPatchKey(metadataPatch, 'menuLabel')
        ? metadataPatch.menuLabel
        : currentSettings?.menuLabel,
      sourceUrl: hasPatchKey(metadataPatch, 'sourceUrl')
        ? metadataPatch.sourceUrl
        : currentSettings?.sourceUrl,
      cuisines: hasPatchKey(metadataPatch, 'cuisines')
        ? metadataPatch.cuisines
        : currentSettings?.cuisines,
      languageCode: hasPatchKey(metadataPatch, 'languageCode')
        ? metadataPatch.languageCode
        : currentSettings?.languageCode,
    });
    const decided = await markFoodMenusImportReviewDecision({
      client,
      restaurantId,
      reviewId,
      decisionStatus: 'applied',
      decisionAction: 'apply_menu_metadata',
      decidedByUserId,
    });
    return { review: decided, item: null };
  }

  if (action === 'mark_inactive' || action === 'mark_sold_out' || action === 'delete_local') {
    if (review.matchStatus !== 'missing_from_google' || !review.localItemId) {
      const error = new Error('FoodMenus import review is not a missing local item.');
      error.name = 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE';
      throw error;
    }
    const item = await decideMissingLocalItemReview({
      client,
      restaurantId,
      review,
      action,
    });
    const decided = await markFoodMenusImportReviewDecision({
      client,
      restaurantId,
      reviewId,
      decisionStatus: 'applied',
      decisionAction: action,
      decidedByUserId,
    });
    return { review: decided, item };
  }

  const suggestedPatch = parseSuggestedPatch(review.suggestedPatch);

  if (action === 'create_new_item') {
    if (review.matchStatus !== 'unmatched' || !isCreateSuggestedPatch(suggestedPatch)) {
      const error = new Error(
        'FoodMenus import review does not contain a safe new item suggestion.',
      );
      error.name = 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE';
      throw error;
    }

    const item =
      review.targetKind === 'drink'
        ? await upsertDrinkItem(
            restaurantId,
            buildDrinkItemInputFromCreatePatch(suggestedPatch),
            client,
          )
        : await upsertMenuItem(
            restaurantId,
            buildMenuItemInputFromCreatePatch(suggestedPatch),
            client,
          );
    const decided = await markFoodMenusImportReviewDecision({
      client,
      restaurantId,
      reviewId,
      decisionStatus: 'applied',
      decisionAction: 'create_new_item',
      decidedByUserId,
    });
    return { review: decided, item };
  }

  if (!review.localItemId || !suggestedPatch) {
    const error = new Error(
      'FoodMenus import review has no matched local item or suggested patch.',
    );
    error.name = 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE';
    throw error;
  }

  const item =
    review.targetKind === 'drink'
      ? await applyDrinkSuggestedPatch({
          client,
          restaurantId,
          localItemId: review.localItemId,
          suggestedPatch,
        })
      : await applyFoodSuggestedPatch({
          client,
          restaurantId,
          localItemId: review.localItemId,
          suggestedPatch,
        });
  const decided = await markFoodMenusImportReviewDecision({
    client,
    restaurantId,
    reviewId,
    decisionStatus: 'applied',
    decisionAction: 'apply_to_nabatable',
    decidedByUserId,
  });
  return { review: decided, item };
}

export async function publishFoodMenusProjectionToGoogle({
  client,
  restaurantId,
  accessToken,
  foodMenusName,
  menuLabel,
  sourceUrl,
  languageCode,
  includeUnavailable,
  cuisines,
  externalProfileId = null,
  createdByUserId = null,
  expectedGoogleHash = null,
  expectedProjectionHash = null,
  publishMode = 'manual',
}: PublishFoodMenusProjectionInput): Promise<PublishedFoodMenusProjection> {
  const [projection, currentGoogleFoodMenus] = await Promise.all([
    prepareFoodMenusProjection({
      client,
      restaurantId,
      foodMenusName,
      menuLabel,
      sourceUrl,
      languageCode,
      includeUnavailable,
      cuisines,
      externalProfileId,
      source: 'preflight',
      createdByUserId,
      persist: true,
    }),
    getGoogleBusinessProfileFoodMenus(accessToken, foodMenusName, {
      readMask: ['name', 'menus'],
    }),
  ]);
  const baselineGoogleHash = hashGoogleFoodMenusResource(currentGoogleFoodMenus);
  const baselineGoogleSnapshot = await recordFoodMenusSnapshot({
    client,
    restaurantId,
    externalProfileId,
    snapshotKind: 'preflight',
    source: 'preflight',
    foodMenusName: currentGoogleFoodMenus.name,
    rawFoodMenus: currentGoogleFoodMenus,
    canonicalFoodMenus: canonicalizeGoogleFoodMenusResource(currentGoogleFoodMenus),
    snapshotHash: baselineGoogleHash,
    pulledAt: new Date().toISOString(),
    createdByUserId,
  });
  const attempt = await openFoodMenusPublishAttempt({
    client,
    restaurantId,
    foodMenusName,
    projectedPayload: projection.projection.foodMenus,
    projectedPayloadHash: projection.projectionHash,
    baselineGoogleHash,
    projectionSnapshotId: projection.snapshot?.id ?? null,
    baselineGoogleSnapshotId: baselineGoogleSnapshot.id,
    publishMode,
    requestedByUserId: createdByUserId,
  });

  if (expectedGoogleHash && expectedGoogleHash !== baselineGoogleHash) {
    const finished = await finishFoodMenusPublishAttempt({
      client,
      attemptId: attempt.id,
      status: 'preflight_failed',
      errorCode: 'baseline_changed',
      errorMessage: 'Google FoodMenus changed since the expected baseline.',
    });
    const error = new Error('Google FoodMenus changed since the expected baseline.');
    error.name = 'GBP_FOOD_MENUS_PREFLIGHT_CHANGED';
    throw Object.assign(error, {
      baselineGoogleHash,
      expectedGoogleHash,
      attempt: finished,
      baselineGoogleSnapshot,
      projection,
    });
  }

  if (expectedProjectionHash && expectedProjectionHash !== projection.projectionHash) {
    const finished = await finishFoodMenusPublishAttempt({
      client,
      attemptId: attempt.id,
      status: 'preflight_failed',
      errorCode: 'projection_changed',
      errorMessage: 'Nabatable FoodMenus projection changed since the expected baseline.',
    });
    const error = new Error('Nabatable FoodMenus projection changed since the expected baseline.');
    error.name = 'GBP_FOOD_MENUS_PROJECTION_CHANGED';
    throw Object.assign(error, {
      projectionHash: projection.projectionHash,
      expectedProjectionHash,
      baselineGoogleHash,
      attempt: finished,
      baselineGoogleSnapshot,
      projection,
    });
  }

  const runningAttempt = await markFoodMenusPublishAttemptRunning({
    client,
    attemptId: attempt.id,
  });

  try {
    const googleResponse = await updateGoogleBusinessProfileFoodMenus(
      accessToken,
      projection.projection.foodMenus,
      { updateMask: ['menus'] },
    );
    const succeeded = await finishFoodMenusPublishAttempt({
      client,
      attemptId: runningAttempt.id,
      status: 'succeeded',
      googleResponse,
    });
    await recordFoodMenusSnapshot({
      client,
      restaurantId,
      externalProfileId,
      snapshotKind: 'google_pull',
      source: 'publish',
      foodMenusName: googleResponse.name,
      rawFoodMenus: googleResponse,
      canonicalFoodMenus: canonicalizeGoogleFoodMenusResource(googleResponse),
      snapshotHash: hashGoogleFoodMenusResource(googleResponse),
      pulledAt: new Date().toISOString(),
      createdByUserId,
    });
    return {
      projection,
      baselineGoogleSnapshot,
      baselineGoogleHash,
      attempt: succeeded,
      googleResponse,
    };
  } catch (error) {
    const failed = await finishFoodMenusPublishAttempt({
      client,
      attemptId: runningAttempt.id,
      status: 'failed',
      errorCode: error instanceof Error ? error.name : 'GBP_FOOD_MENUS_PUBLISH_FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unable to publish Google FoodMenus.',
    });
    return {
      projection,
      baselineGoogleSnapshot,
      baselineGoogleHash,
      attempt: failed,
      googleResponse: null,
    };
  }
}

async function resolvePreviousFoodMenusIdentities({
  client,
  restaurantId,
  projectionSnapshotId,
  previousIdentities,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly projectionSnapshotId?: string | null;
  readonly previousIdentities?: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
}): Promise<{
  readonly projectionSnapshotId: string | null;
  readonly identities: ReadonlyArray<GoogleFoodMenusProjectedIdentity>;
}> {
  if (previousIdentities) {
    return {
      projectionSnapshotId: projectionSnapshotId ?? null,
      identities: previousIdentities,
    };
  }

  const snapshotId =
    projectionSnapshotId ??
    (
      await readLatestFoodMenusSnapshot({
        client,
        restaurantId,
        snapshotKind: 'nabatable_projection',
      })
    )?.id ??
    null;

  if (!snapshotId) {
    return { projectionSnapshotId: null, identities: [] };
  }

  const rows = await listProjectedFoodMenusIdentities({
    client,
    restaurantId,
    snapshotId,
  });
  return {
    projectionSnapshotId: snapshotId,
    identities: rows
      .filter((row) => row.localItemId)
      .map((row) => ({
        stableKey: row.stableKey,
        localItemId: row.localItemId!,
        externalItemId: row.externalItemId,
        itemName: row.itemName,
        sectionKey: row.sectionKey,
        sectionLabel: row.sectionLabel,
        googlePath: row.googlePath,
        googleOptionPaths: row.googleOptionPaths,
      })),
  };
}

type ParsedSuggestedPatch = Partial<
  Pick<
    MenuItemUpsertInput,
    | 'externalItemId'
    | 'itemName'
    | 'category'
    | 'subcategory'
    | 'shortDescription'
    | 'basePrice'
    | 'currency'
    | 'spiceLevel'
    | 'preparationMethod'
    | 'portionSize'
    | 'keyIngredients'
    | 'imageUrl'
    | 'caloriesKcal'
    | 'proteinG'
    | 'fatG'
    | 'saturatedFatG'
    | 'carbsG'
    | 'sugarG'
    | 'fiberG'
    | 'sodiumMg'
    | 'servesNum'
    | 'dietaryTags'
    | 'allergensContains'
    | 'modifierGroups'
  >
>;

function parseSuggestedPatch(value: unknown): ParsedSuggestedPatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const patch: ParsedSuggestedPatch = {};
  if (typeof record.externalItemId === 'string' && record.externalItemId.trim()) {
    patch.externalItemId = record.externalItemId.trim();
  }
  if (typeof record.itemName === 'string' && record.itemName.trim()) {
    patch.itemName = record.itemName.trim();
  }
  if (typeof record.category === 'string' && record.category.trim()) {
    patch.category = record.category.trim();
  }
  if (typeof record.subcategory === 'string' || record.subcategory === null) {
    patch.subcategory =
      typeof record.subcategory === 'string' ? record.subcategory.trim() || null : null;
  }
  if (typeof record.shortDescription === 'string' || record.shortDescription === null) {
    patch.shortDescription =
      typeof record.shortDescription === 'string' ? record.shortDescription.trim() || null : null;
  }
  if (typeof record.basePrice === 'number' && Number.isFinite(record.basePrice)) {
    patch.basePrice = record.basePrice;
  }
  if (typeof record.currency === 'string' && record.currency.trim()) {
    patch.currency = record.currency.trim().toUpperCase();
  }
  if (typeof record.spiceLevel === 'string' || record.spiceLevel === null) {
    patch.spiceLevel =
      typeof record.spiceLevel === 'string' ? record.spiceLevel.trim() || null : null;
  }
  if (typeof record.preparationMethod === 'string' || record.preparationMethod === null) {
    patch.preparationMethod =
      typeof record.preparationMethod === 'string' ? record.preparationMethod.trim() || null : null;
  }
  if (typeof record.portionSize === 'string' || record.portionSize === null) {
    patch.portionSize =
      typeof record.portionSize === 'string' ? record.portionSize.trim() || null : null;
  }
  if (Array.isArray(record.keyIngredients)) {
    patch.keyIngredients = record.keyIngredients.filter(
      (entry): entry is string => typeof entry === 'string',
    );
  }
  if (typeof record.imageUrl === 'string' || record.imageUrl === null) {
    patch.imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() || null : null;
  }
  for (const key of [
    'caloriesKcal',
    'proteinG',
    'fatG',
    'saturatedFatG',
    'carbsG',
    'sugarG',
    'fiberG',
    'sodiumMg',
    'servesNum',
  ] as const) {
    const value = record[key];
    if ((typeof value === 'number' && Number.isFinite(value)) || value === null) {
      patch[key] = value;
    }
  }
  if (Array.isArray(record.dietaryTags)) {
    patch.dietaryTags = record.dietaryTags.filter(
      (entry): entry is string => typeof entry === 'string',
    );
  }
  if (Array.isArray(record.allergensContains)) {
    patch.allergensContains = record.allergensContains.filter(
      (entry): entry is string => typeof entry === 'string',
    );
  }
  if (Array.isArray(record.modifierGroups)) {
    patch.modifierGroups = record.modifierGroups.flatMap(
      (group): MenuItemUpsertInput['modifierGroups'] => {
        if (!group || typeof group !== 'object' || Array.isArray(group)) {
          return [];
        }
        const groupRecord = group as Record<string, unknown>;
        if (
          typeof groupRecord.externalModifierGroupId !== 'string' ||
          !groupRecord.externalModifierGroupId.trim() ||
          typeof groupRecord.groupName !== 'string' ||
          !groupRecord.groupName.trim()
        ) {
          return [];
        }
        return [
          {
            externalModifierGroupId: groupRecord.externalModifierGroupId.trim(),
            groupName: groupRecord.groupName.trim(),
            required: groupRecord.required === true,
            minSelect:
              typeof groupRecord.minSelect === 'number' && Number.isInteger(groupRecord.minSelect)
                ? groupRecord.minSelect
                : 0,
            maxSelect:
              typeof groupRecord.maxSelect === 'number' && Number.isInteger(groupRecord.maxSelect)
                ? groupRecord.maxSelect
                : 1,
            displayOrder:
              typeof groupRecord.displayOrder === 'number' &&
              Number.isInteger(groupRecord.displayOrder)
                ? groupRecord.displayOrder
                : 0,
            options: Array.isArray(groupRecord.options)
              ? groupRecord.options.flatMap((option, optionIndex) => {
                  if (!option || typeof option !== 'object' || Array.isArray(option)) {
                    return [];
                  }
                  const optionRecord = option as Record<string, unknown>;
                  if (
                    typeof optionRecord.externalModifierOptionId !== 'string' ||
                    !optionRecord.externalModifierOptionId.trim() ||
                    typeof optionRecord.optionName !== 'string' ||
                    !optionRecord.optionName.trim()
                  ) {
                    return [];
                  }
                  return [
                    {
                      externalModifierOptionId: optionRecord.externalModifierOptionId.trim(),
                      optionName: optionRecord.optionName.trim(),
                      priceDelta:
                        typeof optionRecord.priceDelta === 'number' &&
                        Number.isFinite(optionRecord.priceDelta)
                          ? optionRecord.priceDelta
                          : 0,
                      defaultSelected: optionRecord.defaultSelected === true,
                      availabilityStatus:
                        optionRecord.availabilityStatus === 'unavailable'
                          ? 'unavailable'
                          : 'available',
                      displayOrder:
                        typeof optionRecord.displayOrder === 'number' &&
                        Number.isInteger(optionRecord.displayOrder)
                          ? optionRecord.displayOrder
                          : optionIndex,
                    },
                  ];
                })
              : [],
          },
        ];
      },
    );
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function isCreateSuggestedPatch(
  patch: ReturnType<typeof parseSuggestedPatch>,
): patch is NonNullable<ReturnType<typeof parseSuggestedPatch>> &
  Pick<MenuItemUpsertInput, 'externalItemId' | 'itemName' | 'category' | 'basePrice'> {
  return Boolean(
    patch &&
    patch.externalItemId &&
    patch.itemName &&
    patch.category &&
    typeof patch.basePrice === 'number' &&
    Number.isFinite(patch.basePrice) &&
    patch.basePrice >= 0,
  );
}

function parseMenuMetadataPatch(value: unknown): {
  readonly menuLabel?: string | null;
  readonly sourceUrl?: string | null;
  readonly cuisines?: GoogleFoodMenuCuisine[];
  readonly languageCode?: string | null;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const patch: {
    menuLabel?: string | null;
    sourceUrl?: string | null;
    cuisines?: GoogleFoodMenuCuisine[];
    languageCode?: string | null;
  } = {};
  if (typeof record.menuLabel === 'string' || record.menuLabel === null) {
    patch.menuLabel = typeof record.menuLabel === 'string' ? record.menuLabel.trim() || null : null;
  }
  if (typeof record.sourceUrl === 'string' || record.sourceUrl === null) {
    patch.sourceUrl = typeof record.sourceUrl === 'string' ? record.sourceUrl.trim() || null : null;
  }
  if (Array.isArray(record.cuisines)) {
    patch.cuisines = record.cuisines.filter(
      (entry): entry is GoogleFoodMenuCuisine => typeof entry === 'string',
    );
  }
  if (typeof record.languageCode === 'string' || record.languageCode === null) {
    patch.languageCode =
      typeof record.languageCode === 'string' ? record.languageCode.trim() || null : null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function hasPatchKey<T extends object, K extends PropertyKey>(
  patch: T,
  key: K,
): patch is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(patch, key);
}

function buildMenuItemInputFromCreatePatch(
  patch: NonNullable<ReturnType<typeof parseSuggestedPatch>> &
    Pick<MenuItemUpsertInput, 'externalItemId' | 'itemName' | 'category' | 'basePrice'>,
): MenuItemUpsertInput {
  return {
    externalItemId: patch.externalItemId,
    itemName: patch.itemName,
    category: patch.category,
    subcategory: patch.subcategory ?? null,
    shortDescription: patch.shortDescription ?? null,
    fullDescription: null,
    basePrice: patch.basePrice,
    currency: patch.currency ?? 'GBP',
    serviceTime: null,
    availabilityStatus: 'available',
    keyIngredients: patch.keyIngredients ? [...patch.keyIngredients] : [],
    mainProteinOrBase: null,
    cookingStyle: null,
    preparationMethod: patch.preparationMethod ?? null,
    flavorProfile: null,
    texture: null,
    spiceLevel: patch.spiceLevel ?? null,
    spiceAdjustable: false,
    portionSize: patch.portionSize ?? null,
    shareable: false,
    recommendationTags: [],
    pairings: [],
    signatureScore: null,
    popularityScore: null,
    dietaryTags: patch.dietaryTags ? [...patch.dietaryTags] : [],
    allergensContains: patch.allergensContains ? [...patch.allergensContains] : [],
    allergensMayContain: [],
    removableIngredients: [],
    substitutionsAllowed: false,
    canBeMadeVegetarian: patch.dietaryTags?.includes('Vegetarian') ?? false,
    canBeMadeVegan: patch.dietaryTags?.includes('Vegan') ?? false,
    canBeMadeGlutenFree: patch.dietaryTags?.includes('Gluten free') ?? false,
    customizationRules: null,
    servingNotes: null,
    active: true,
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    displayOrder: 0,
    imageUrl: patch.imageUrl ?? null,
    caloriesKcal: patch.caloriesKcal ?? null,
    proteinG: patch.proteinG ?? null,
    fatG: patch.fatG ?? null,
    saturatedFatG: patch.saturatedFatG ?? null,
    carbsG: patch.carbsG ?? null,
    sugarG: patch.sugarG ?? null,
    fiberG: patch.fiberG ?? null,
    sodiumMg: patch.sodiumMg ?? null,
    servesNum: patch.servesNum ?? null,
    modifierGroups: patch.modifierGroups ? [...patch.modifierGroups] : [],
  };
}

function mergeMenuItemDetailWithSuggestedPatch(
  item: MenuItemDetail,
  patch: NonNullable<ReturnType<typeof parseSuggestedPatch>>,
): MenuItemUpsertInput {
  return {
    externalItemId: item.externalItemId,
    itemName: patch.itemName ?? item.itemName,
    category: item.category,
    subcategory: item.subcategory,
    shortDescription:
      patch.shortDescription !== undefined ? patch.shortDescription : item.shortDescription,
    fullDescription: item.fullDescription,
    basePrice: patch.basePrice ?? item.basePrice,
    currency: patch.currency ?? item.currency,
    serviceTime: item.serviceTime,
    availabilityStatus: item.availabilityStatus,
    keyIngredients: patch.keyIngredients ? [...patch.keyIngredients] : [...item.keyIngredients],
    mainProteinOrBase: item.mainProteinOrBase,
    cookingStyle: item.cookingStyle,
    preparationMethod:
      patch.preparationMethod !== undefined ? patch.preparationMethod : item.preparationMethod,
    flavorProfile: item.flavorProfile,
    texture: item.texture,
    spiceLevel: patch.spiceLevel !== undefined ? patch.spiceLevel : item.spiceLevel,
    spiceAdjustable: item.spiceAdjustable,
    portionSize: patch.portionSize !== undefined ? patch.portionSize : item.portionSize,
    shareable: item.shareable,
    recommendationTags: [...item.recommendationTags],
    pairings: [...item.pairings],
    signatureScore: item.signatureScore,
    popularityScore: item.popularityScore,
    dietaryTags: patch.dietaryTags ? [...patch.dietaryTags] : [...item.dietaryTags],
    allergensContains: patch.allergensContains
      ? [...patch.allergensContains]
      : [...item.allergensContains],
    allergensMayContain: [...item.allergensMayContain],
    removableIngredients: [...item.removableIngredients],
    substitutionsAllowed: item.substitutionsAllowed,
    canBeMadeVegetarian: item.canBeMadeVegetarian,
    canBeMadeVegan: item.canBeMadeVegan,
    canBeMadeGlutenFree: item.canBeMadeGlutenFree,
    customizationRules: item.customizationRules,
    servingNotes: item.servingNotes,
    active: item.active,
    seasonal: item.seasonal,
    limitedTime: item.limitedTime,
    soldOut: item.soldOut,
    displayOrder: item.displayOrder,
    imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : item.imageUrl,
    caloriesKcal: patch.caloriesKcal !== undefined ? patch.caloriesKcal : item.caloriesKcal,
    proteinG: patch.proteinG !== undefined ? patch.proteinG : item.proteinG,
    fatG: patch.fatG !== undefined ? patch.fatG : item.fatG,
    saturatedFatG: patch.saturatedFatG !== undefined ? patch.saturatedFatG : item.saturatedFatG,
    carbsG: patch.carbsG !== undefined ? patch.carbsG : item.carbsG,
    sugarG: patch.sugarG !== undefined ? patch.sugarG : item.sugarG,
    fiberG: patch.fiberG !== undefined ? patch.fiberG : item.fiberG,
    sodiumMg: patch.sodiumMg !== undefined ? patch.sodiumMg : item.sodiumMg,
    servesNum: patch.servesNum !== undefined ? patch.servesNum : item.servesNum,
    modifierGroups: (patch.modifierGroups ?? item.modifierGroups).map((group) => ({
      externalModifierGroupId: group.externalModifierGroupId,
      groupName: group.groupName,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      displayOrder: group.displayOrder,
      options: group.options.map((option) => ({
        externalModifierOptionId: option.externalModifierOptionId,
        optionName: option.optionName,
        priceDelta: option.priceDelta,
        defaultSelected: option.defaultSelected,
        availabilityStatus: option.availabilityStatus,
        displayOrder: option.displayOrder,
      })),
    })),
  };
}

async function applyFoodSuggestedPatch({
  client,
  restaurantId,
  localItemId,
  suggestedPatch,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly localItemId: string;
  readonly suggestedPatch: NonNullable<ReturnType<typeof parseSuggestedPatch>>;
}): Promise<MenuItemDetail> {
  const current = await getMenuItemDetail(restaurantId, localItemId, client);
  if (!current) {
    const error = new Error('Matched menu item was not found.');
    error.name = 'GBP_FOOD_MENUS_MENU_ITEM_NOT_FOUND';
    throw error;
  }
  return upsertMenuItem(
    restaurantId,
    mergeMenuItemDetailWithSuggestedPatch(current, suggestedPatch),
    client,
  );
}

function buildDrinkItemInputFromCreatePatch(
  patch: NonNullable<ReturnType<typeof parseSuggestedPatch>> &
    Pick<MenuItemUpsertInput, 'externalItemId' | 'itemName' | 'category' | 'basePrice'>,
): DrinkItemUpsertInput {
  return {
    externalDrinkId: patch.externalItemId,
    drinkName: patch.itemName,
    category: patch.category,
    subcategory: patch.subcategory ?? null,
    shortDescription: patch.shortDescription ?? null,
    fullDescription: null,
    basePrice: patch.basePrice,
    currency: patch.currency ?? 'GBP',
    serviceTime: null,
    availabilityStatus: 'available',
    drinkType: null,
    alcoholic: false,
    abv: null,
    volumeMl: null,
    servingSize: patch.portionSize ?? null,
    servedStyle: patch.preparationMethod ?? null,
    temperature: null,
    baseSpirit: null,
    beerStyle: null,
    wineType: null,
    grapeVarietal: null,
    region: null,
    country: null,
    roastLevel: null,
    caffeineLevel: null,
    sweetnessLevel: null,
    bitternessLevel: null,
    acidityLevel: null,
    bodyLevel: null,
    flavorProfile: null,
    keyIngredients: patch.keyIngredients ? [...patch.keyIngredients] : [],
    garnish: null,
    containsDairy: patch.allergensContains?.includes('Milk') ?? false,
    containsNuts: patch.allergensContains?.includes('Nuts') ?? false,
    containsGluten: patch.allergensContains?.includes('Wheat') ?? false,
    containsCaffeine: false,
    dietaryTags: patch.dietaryTags ? [...patch.dietaryTags] : [],
    allergensContains: patch.allergensContains ? [...patch.allergensContains] : [],
    allergensMayContain: [],
    canBeMadeNonAlcoholic: false,
    canBeMadeDecaf: false,
    customizationRules: null,
    pairings: [],
    signatureScore: null,
    popularityScore: null,
    recommendationTags: [],
    seasonal: false,
    limitedTime: false,
    soldOut: false,
    active: true,
    displayOrder: 0,
    imageUrl: patch.imageUrl ?? null,
    caloriesKcal: patch.caloriesKcal ?? null,
    proteinG: patch.proteinG ?? null,
    fatG: patch.fatG ?? null,
    saturatedFatG: patch.saturatedFatG ?? null,
    carbsG: patch.carbsG ?? null,
    sugarG: patch.sugarG ?? null,
    fiberG: patch.fiberG ?? null,
    sodiumMg: patch.sodiumMg ?? null,
    servesNum: patch.servesNum ?? null,
    modifierGroups: patch.modifierGroups ? [...patch.modifierGroups] : [],
  };
}

function mergeDrinkItemDetailWithSuggestedPatch(
  item: DrinkItemDetail,
  patch: NonNullable<ReturnType<typeof parseSuggestedPatch>>,
): DrinkItemUpsertInput {
  return {
    externalDrinkId: item.externalDrinkId,
    drinkName: patch.itemName ?? item.drinkName,
    category: item.category,
    subcategory: item.subcategory,
    shortDescription:
      patch.shortDescription !== undefined ? patch.shortDescription : item.shortDescription,
    fullDescription: item.fullDescription,
    basePrice: patch.basePrice ?? item.basePrice,
    currency: patch.currency ?? item.currency,
    serviceTime: item.serviceTime,
    availabilityStatus: item.availabilityStatus,
    drinkType: item.drinkType,
    alcoholic: item.alcoholic,
    abv: item.abv,
    volumeMl: item.volumeMl,
    servingSize: patch.portionSize !== undefined ? patch.portionSize : item.servingSize,
    servedStyle: patch.preparationMethod !== undefined ? patch.preparationMethod : item.servedStyle,
    temperature: item.temperature,
    baseSpirit: item.baseSpirit,
    beerStyle: item.beerStyle,
    wineType: item.wineType,
    grapeVarietal: item.grapeVarietal,
    region: item.region,
    country: item.country,
    roastLevel: item.roastLevel,
    caffeineLevel: item.caffeineLevel,
    sweetnessLevel: item.sweetnessLevel,
    bitternessLevel: item.bitternessLevel,
    acidityLevel: item.acidityLevel,
    bodyLevel: item.bodyLevel,
    flavorProfile: item.flavorProfile,
    keyIngredients: patch.keyIngredients ? [...patch.keyIngredients] : [...item.keyIngredients],
    garnish: item.garnish,
    containsDairy: item.containsDairy,
    containsNuts: item.containsNuts,
    containsGluten: item.containsGluten,
    containsCaffeine: item.containsCaffeine,
    dietaryTags: patch.dietaryTags ? [...patch.dietaryTags] : [...item.dietaryTags],
    allergensContains: patch.allergensContains
      ? [...patch.allergensContains]
      : [...item.allergensContains],
    allergensMayContain: [...item.allergensMayContain],
    canBeMadeNonAlcoholic: item.canBeMadeNonAlcoholic,
    canBeMadeDecaf: item.canBeMadeDecaf,
    customizationRules: item.customizationRules,
    pairings: [...item.pairings],
    signatureScore: item.signatureScore,
    popularityScore: item.popularityScore,
    recommendationTags: [...item.recommendationTags],
    seasonal: item.seasonal,
    limitedTime: item.limitedTime,
    soldOut: item.soldOut,
    active: item.active,
    displayOrder: item.displayOrder,
    imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : item.imageUrl,
    caloriesKcal: patch.caloriesKcal !== undefined ? patch.caloriesKcal : item.caloriesKcal,
    proteinG: patch.proteinG !== undefined ? patch.proteinG : item.proteinG,
    fatG: patch.fatG !== undefined ? patch.fatG : item.fatG,
    saturatedFatG: patch.saturatedFatG !== undefined ? patch.saturatedFatG : item.saturatedFatG,
    carbsG: patch.carbsG !== undefined ? patch.carbsG : item.carbsG,
    sugarG: patch.sugarG !== undefined ? patch.sugarG : item.sugarG,
    fiberG: patch.fiberG !== undefined ? patch.fiberG : item.fiberG,
    sodiumMg: patch.sodiumMg !== undefined ? patch.sodiumMg : item.sodiumMg,
    servesNum: patch.servesNum !== undefined ? patch.servesNum : item.servesNum,
    modifierGroups: (patch.modifierGroups ?? item.modifierGroups).map((group) => ({
      externalModifierGroupId: group.externalModifierGroupId,
      groupName: group.groupName,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      displayOrder: group.displayOrder,
      options: group.options.map((option) => ({
        externalModifierOptionId: option.externalModifierOptionId,
        optionName: option.optionName,
        priceDelta: option.priceDelta,
        defaultSelected: option.defaultSelected,
        availabilityStatus: option.availabilityStatus,
        displayOrder: option.displayOrder,
      })),
    })),
  };
}

async function applyDrinkSuggestedPatch({
  client,
  restaurantId,
  localItemId,
  suggestedPatch,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly localItemId: string;
  readonly suggestedPatch: NonNullable<ReturnType<typeof parseSuggestedPatch>>;
}): Promise<DrinkItemDetail> {
  const current = await getDrinkItemDetail(restaurantId, localItemId, client);
  if (!current) {
    const error = new Error('Matched drink item was not found.');
    error.name = 'GBP_FOOD_MENUS_MENU_ITEM_NOT_FOUND';
    throw error;
  }
  return upsertDrinkItem(
    restaurantId,
    mergeDrinkItemDetailWithSuggestedPatch(current, suggestedPatch),
    client,
  );
}

async function decideMissingLocalItemReview({
  client,
  restaurantId,
  review,
  action,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly review: FoodMenusImportReviewRecord;
  readonly action: Extract<
    FoodMenusImportReviewDecisionAction,
    'mark_inactive' | 'mark_sold_out' | 'delete_local'
  >;
}): Promise<MenuItemDetail | DrinkItemDetail | null> {
  if (!review.localItemId) {
    return null;
  }
  if (action === 'delete_local') {
    if (review.targetKind === 'drink') {
      await deleteDrinkItem(restaurantId, review.localItemId, client);
    } else {
      await deleteMenuItem(restaurantId, review.localItemId, client);
    }
    return null;
  }
  if (review.targetKind === 'drink') {
    const current = await getDrinkItemDetail(restaurantId, review.localItemId, client);
    if (!current) {
      const error = new Error('Matched drink item was not found.');
      error.name = 'GBP_FOOD_MENUS_MENU_ITEM_NOT_FOUND';
      throw error;
    }
    return upsertDrinkItem(
      restaurantId,
      {
        ...mergeDrinkItemDetailWithSuggestedPatch(current, {}),
        ...(action === 'mark_sold_out' ? { soldOut: true } : { active: false }),
      },
      client,
    );
  }
  const current = await getMenuItemDetail(restaurantId, review.localItemId, client);
  if (!current) {
    const error = new Error('Matched menu item was not found.');
    error.name = 'GBP_FOOD_MENUS_MENU_ITEM_NOT_FOUND';
    throw error;
  }
  return upsertMenuItem(
    restaurantId,
    {
      ...mergeMenuItemDetailWithSuggestedPatch(current, {}),
      ...(action === 'mark_sold_out' ? { soldOut: true } : { active: false }),
    },
    client,
  );
}
