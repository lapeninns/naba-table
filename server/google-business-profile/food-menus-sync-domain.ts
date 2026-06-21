import {
  hasPatchKey,
  isCreateSuggestedPatch,
  parseMenuMetadataPatch,
  parseSuggestedPatch,
  type FoodMenusImportReviewDecisionAction,
} from './food-menus-import-decision-domain';

import type {
  GoogleFoodMenuCuisine,
  GoogleFoodMenusImportItemSuggestedPatch,
  GoogleFoodMenusProjectedIdentity,
} from './food-menus';
import type {
  FoodMenuSettings,
  FoodMenusImportReviewRecord,
  FoodMenusProjectedIdentityRecord,
  FoodMenusPublishAttempt,
  FoodMenusSnapshot,
} from './food-menus-storage';
import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

export interface FoodMenusImportReviewSettings {
  readonly menuLabel: string | null;
  readonly sourceUrl: string | null;
  readonly cuisines: GoogleFoodMenuCuisine[];
  readonly languageCode: string | null;
}

export interface FoodMenuSettingsUpdate {
  readonly menuLabel?: string | null;
  readonly sourceUrl?: string | null;
  readonly cuisines?: string[] | null;
  readonly languageCode?: string | null;
}

export const FOOD_MENUS_BASELINE_CHANGED_ERROR_MESSAGE =
  'Google FoodMenus changed since the expected baseline.';
export const FOOD_MENUS_PROJECTION_CHANGED_ERROR_MESSAGE =
  'Nabatable FoodMenus projection changed since the expected baseline.';

type ParsedFoodMenusSuggestedPatch = NonNullable<ReturnType<typeof parseSuggestedPatch>>;
type CreateFoodMenusSuggestedPatch = GoogleFoodMenusImportItemSuggestedPatch & {
  readonly externalItemId: string;
  readonly itemName: string;
  readonly category: string;
  readonly basePrice: number;
};

export type FoodMenusImportReviewDecisionPlan =
  | { readonly kind: 'ignore_google_change' }
  | {
      readonly kind: 'apply_menu_metadata';
      readonly metadataPatch: NonNullable<ReturnType<typeof parseMenuMetadataPatch>>;
    }
  | {
      readonly kind: 'missing_local_item';
      readonly action: Extract<
        FoodMenusImportReviewDecisionAction,
        'mark_inactive' | 'mark_sold_out' | 'delete_local'
      >;
      readonly localItemId: string;
    }
  | {
      readonly kind: 'create_new_item';
      readonly targetKind: FoodMenusImportReviewRecord['targetKind'];
      readonly suggestedPatch: CreateFoodMenusSuggestedPatch;
    }
  | {
      readonly kind: 'apply_to_nabatable';
      readonly localItemId: string;
      readonly suggestedPatch: ParsedFoodMenusSuggestedPatch;
    };

function createFoodMenusReviewNotApplicableError(message: string): Error {
  const error = new Error(message);
  error.name = 'GBP_FOOD_MENUS_REVIEW_NOT_APPLICABLE';
  return error;
}

export function resolveFoodMenusImportReviewDecisionPlan(
  review: FoodMenusImportReviewRecord,
  action: FoodMenusImportReviewDecisionAction,
): FoodMenusImportReviewDecisionPlan {
  if (action === 'ignore_google_change') {
    return { kind: 'ignore_google_change' };
  }

  if (action === 'apply_menu_metadata') {
    const metadataPatch = parseMenuMetadataPatch(review.suggestedPatch);
    if (review.matchStatus !== 'menu_metadata' || !metadataPatch) {
      throw createFoodMenusReviewNotApplicableError(
        'FoodMenus import review does not contain menu metadata.',
      );
    }
    return { kind: 'apply_menu_metadata', metadataPatch };
  }

  if (action === 'mark_inactive' || action === 'mark_sold_out' || action === 'delete_local') {
    if (review.matchStatus !== 'missing_from_google' || !review.localItemId) {
      throw createFoodMenusReviewNotApplicableError(
        'FoodMenus import review is not a missing local item.',
      );
    }
    return { kind: 'missing_local_item', action, localItemId: review.localItemId };
  }

  const suggestedPatch = parseSuggestedPatch(review.suggestedPatch);

  if (action === 'create_new_item') {
    if (review.matchStatus !== 'unmatched' || !isCreateSuggestedPatch(suggestedPatch)) {
      throw createFoodMenusReviewNotApplicableError(
        'FoodMenus import review does not contain a safe new item suggestion.',
      );
    }

    return { kind: 'create_new_item', targetKind: review.targetKind, suggestedPatch };
  }

  if (!review.localItemId || !suggestedPatch) {
    throw createFoodMenusReviewNotApplicableError(
      'FoodMenus import review has no matched local item or suggested patch.',
    );
  }

  return { kind: 'apply_to_nabatable', localItemId: review.localItemId, suggestedPatch };
}

export function buildFoodMenuSettingsUpdateFromMetadataPatch(
  currentSettings: FoodMenuSettings | null,
  metadataPatch: NonNullable<ReturnType<typeof parseMenuMetadataPatch>>,
): FoodMenuSettingsUpdate {
  return {
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
  };
}

export type FoodMenusPublishPreflightHashDecision =
  | { readonly status: 'ready' }
  | {
      readonly status: 'failed';
      readonly kind: 'baseline_changed';
      readonly errorCode: 'baseline_changed';
      readonly errorMessage: typeof FOOD_MENUS_BASELINE_CHANGED_ERROR_MESSAGE;
      readonly baselineGoogleHash: string;
      readonly expectedGoogleHash: string;
    }
  | {
      readonly status: 'failed';
      readonly kind: 'projection_changed';
      readonly errorCode: 'projection_changed';
      readonly errorMessage: typeof FOOD_MENUS_PROJECTION_CHANGED_ERROR_MESSAGE;
      readonly projectionHash: string;
      readonly expectedProjectionHash: string;
    };

export function resolveFoodMenusPublishPreflightHashDecision(params: {
  readonly baselineGoogleHash: string;
  readonly projectionHash: string;
  readonly expectedGoogleHash?: string | null;
  readonly expectedProjectionHash?: string | null;
}): FoodMenusPublishPreflightHashDecision {
  if (params.expectedGoogleHash && params.expectedGoogleHash !== params.baselineGoogleHash) {
    return {
      status: 'failed',
      kind: 'baseline_changed',
      errorCode: 'baseline_changed',
      errorMessage: FOOD_MENUS_BASELINE_CHANGED_ERROR_MESSAGE,
      baselineGoogleHash: params.baselineGoogleHash,
      expectedGoogleHash: params.expectedGoogleHash,
    };
  }

  if (params.expectedProjectionHash && params.expectedProjectionHash !== params.projectionHash) {
    return {
      status: 'failed',
      kind: 'projection_changed',
      errorCode: 'projection_changed',
      errorMessage: FOOD_MENUS_PROJECTION_CHANGED_ERROR_MESSAGE,
      projectionHash: params.projectionHash,
      expectedProjectionHash: params.expectedProjectionHash,
    };
  }

  return { status: 'ready' };
}

export function selectCanonicalPublishableFoodMenus(
  menus: ReadonlyArray<CanonicalRestaurantMenu>,
): CanonicalRestaurantMenu[] {
  return menus.filter(
    (menu) => menu.active && (menu.menuKind === 'food' || menu.menuKind === 'mixed'),
  );
}

export function countCanonicalFoodMenuItems(
  menus: ReadonlyArray<Pick<CanonicalRestaurantMenu, 'sections'>>,
): number {
  return menus.reduce(
    (count, menu) =>
      count +
      menu.sections.reduce((sectionCount, section) => sectionCount + section.items.length, 0),
    0,
  );
}

export function buildFoodMenusImportReviewSettings(
  settings: FoodMenuSettings | null,
): FoodMenusImportReviewSettings | null {
  if (!settings) return null;

  return {
    menuLabel: settings.menuLabel,
    sourceUrl: settings.sourceUrl,
    cuisines: settings.cuisines as GoogleFoodMenuCuisine[],
    languageCode: settings.languageCode,
  };
}

export function mapProjectedFoodMenusIdentityRows(
  rows: ReadonlyArray<FoodMenusProjectedIdentityRecord>,
): GoogleFoodMenusProjectedIdentity[] {
  return rows
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
    }));
}

export function createFoodMenusBaselineChangedError<TProjection>(params: {
  readonly baselineGoogleHash: string;
  readonly expectedGoogleHash: string;
  readonly attempt: FoodMenusPublishAttempt;
  readonly baselineGoogleSnapshot: FoodMenusSnapshot;
  readonly projection: TProjection;
}): Error & {
  readonly baselineGoogleHash: string;
  readonly expectedGoogleHash: string;
  readonly attempt: FoodMenusPublishAttempt;
  readonly baselineGoogleSnapshot: FoodMenusSnapshot;
  readonly projection: TProjection;
} {
  const error = new Error(FOOD_MENUS_BASELINE_CHANGED_ERROR_MESSAGE);
  error.name = 'GBP_FOOD_MENUS_PREFLIGHT_CHANGED';
  return Object.assign(error, params);
}

export function createFoodMenusProjectionChangedError<TProjection>(params: {
  readonly projectionHash: string;
  readonly expectedProjectionHash: string;
  readonly baselineGoogleHash: string;
  readonly attempt: FoodMenusPublishAttempt;
  readonly baselineGoogleSnapshot: FoodMenusSnapshot;
  readonly projection: TProjection;
}): Error & {
  readonly projectionHash: string;
  readonly expectedProjectionHash: string;
  readonly baselineGoogleHash: string;
  readonly attempt: FoodMenusPublishAttempt;
  readonly baselineGoogleSnapshot: FoodMenusSnapshot;
  readonly projection: TProjection;
} {
  const error = new Error(FOOD_MENUS_PROJECTION_CHANGED_ERROR_MESSAGE);
  error.name = 'GBP_FOOD_MENUS_PROJECTION_CHANGED';
  return Object.assign(error, params);
}

export function normalizeFoodMenusPublishFailure(error: unknown): {
  readonly publishError: Error;
  readonly errorCode: string;
  readonly errorMessage: string;
} {
  const publishError =
    error instanceof Error ? error : new Error('Unable to publish Google FoodMenus.');
  const errorCode = error instanceof Error ? error.name : 'GBP_FOOD_MENUS_PUBLISH_FAILED';
  const errorMessage =
    error instanceof Error ? error.message : 'Unable to publish Google FoodMenus.';

  if (publishError.name === 'Error') {
    publishError.name = 'GBP_FOOD_MENUS_PUBLISH_FAILED';
  }

  return { publishError, errorCode, errorMessage };
}
