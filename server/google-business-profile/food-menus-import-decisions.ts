import { logger } from '@/lib/logger';

import {
  applyCanonicalFoodMenusSuggestedPatch,
  createCanonicalFoodMenusItemFromPatch,
  decideCanonicalMissingLocalFoodMenusItem,
} from './food-menus-canonical-adapter';
import {
  claimFoodMenusImportReviewDecision,
  markFoodMenusImportReviewDecisionFailed,
  markFoodMenusImportReviewDecision,
  readFoodMenuSettings,
  readFoodMenusImportReviewForRestaurant,
  upsertFoodMenuSettings,
  type FoodMenusImportReviewRecord,
} from './food-menus-storage';
import {
  buildFoodMenuSettingsUpdateFromMetadataPatch,
  resolveFoodMenusImportReviewDecisionPlan,
} from './food-menus-sync-domain';

import type { FoodMenusImportReviewDecisionAction } from './food-menus-import-decision-domain';
import type { CanonicalRestaurantMenuItem } from '@/server/menu-hierarchy/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface DecideFoodMenusImportReviewInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly reviewId: string;
  readonly action: FoodMenusImportReviewDecisionAction;
  readonly decidedByUserId?: string | null;
}

export interface DecidedFoodMenusImportReview {
  readonly review: FoodMenusImportReviewRecord;
  readonly item: CanonicalRestaurantMenuItem | null;
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

  const claimDecision = () =>
    claimFoodMenusImportReviewDecision({
      client,
      restaurantId,
      reviewId,
      decisionAction: action,
      decidedByUserId,
    });
  const decisionPlan = resolveFoodMenusImportReviewDecisionPlan(review, action);
  let claimed = false;
  const claimDecisionForSideEffects = async () => {
    const claimedReview = await claimDecision();
    claimed = true;
    return claimedReview;
  };

  try {
    if (decisionPlan.kind === 'ignore_google_change') {
      await claimDecisionForSideEffects();
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

    if (decisionPlan.kind === 'apply_menu_metadata') {
      const currentSettings = await readFoodMenuSettings({ client, restaurantId });
      await claimDecisionForSideEffects();
      await upsertFoodMenuSettings({
        client,
        restaurantId,
        ...buildFoodMenuSettingsUpdateFromMetadataPatch(
          currentSettings,
          decisionPlan.metadataPatch,
        ),
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

    if (decisionPlan.kind === 'missing_local_item') {
      await claimDecisionForSideEffects();
      const item = await decideMissingLocalItemReview({
        client,
        restaurantId,
        review,
        action: decisionPlan.action,
      });
      const decided = await markFoodMenusImportReviewDecision({
        client,
        restaurantId,
        reviewId,
        decisionStatus: 'applied',
        decisionAction: decisionPlan.action,
        decidedByUserId,
      });
      return { review: decided, item };
    }

    if (decisionPlan.kind === 'create_new_item') {
      await claimDecisionForSideEffects();
      const item = await createCanonicalFoodMenusItemFromPatch({
        client,
        restaurantId,
        targetKind: decisionPlan.targetKind,
        suggestedPatch: decisionPlan.suggestedPatch,
        reviewId,
      });
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

    await claimDecisionForSideEffects();
    const item = await applyCanonicalFoodMenusSuggestedPatch({
      client,
      restaurantId,
      localItemId: decisionPlan.localItemId,
      suggestedPatch: decisionPlan.suggestedPatch,
      reviewId,
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
  } catch (error) {
    if (claimed) {
      try {
        await markFoodMenusImportReviewDecisionFailed({
          client,
          restaurantId,
          reviewId,
          decisionAction: action,
          decidedByUserId,
        });
      } catch (markFailedError) {
        logger.error('Food menus import review failure transition failed.', {
          module: 'gbp',
          reviewId,
          errorKind: markFailedError instanceof Error ? 'error' : typeof markFailedError,
        });
      }
    }
    throw error;
  }
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
}): Promise<CanonicalRestaurantMenuItem | null> {
  if (!review.localItemId) {
    return null;
  }
  return decideCanonicalMissingLocalFoodMenusItem({
    client,
    restaurantId,
    localItemId: review.localItemId,
    action,
    reviewId: review.id,
  });
}
