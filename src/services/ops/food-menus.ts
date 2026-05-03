import { fetchJson } from '@/lib/http/fetchJson';

import type { FoodMenusImportReviewRecord } from '@/server/google-business-profile/food-menus-storage';
import type { FoodMenusImportReviewDecisionAction } from '@/server/google-business-profile/food-menus-sync';

const baseUrl = (restaurantId: string): string =>
  `/api/ops/restaurants/${encodeURIComponent(restaurantId)}/google-business-profile/food-menus`;

export interface ListFoodMenusImportReviewsResponse {
  readonly rows: ReadonlyArray<FoodMenusImportReviewRecord>;
  readonly pendingCount: number;
}

export async function listFoodMenusImportReviews(
  restaurantId: string,
): Promise<ListFoodMenusImportReviewsResponse> {
  return fetchJson<ListFoodMenusImportReviewsResponse>(`${baseUrl(restaurantId)}/import-review`);
}

export interface RefreshFoodMenusImportReviewRequest {
  readonly projectionSnapshotId?: string | null;
  readonly persist?: boolean;
}

export interface RefreshFoodMenusImportReviewResponse {
  readonly googleFoodMenusHash: string;
  readonly localItemCount: number;
  readonly previousIdentityCount: number;
  readonly projectionSnapshotId: string | null;
  readonly googleSnapshot: unknown;
  readonly review: unknown;
  readonly rows: ReadonlyArray<FoodMenusImportReviewRecord>;
  readonly persisted: boolean;
}

export async function refreshFoodMenusImportReview(
  restaurantId: string,
  request: RefreshFoodMenusImportReviewRequest = {},
): Promise<RefreshFoodMenusImportReviewResponse> {
  return fetchJson<RefreshFoodMenusImportReviewResponse>(
    `${baseUrl(restaurantId)}/import-review/refresh`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
}

export interface DecideFoodMenusImportReviewRequest {
  readonly reviewId: string;
  readonly action: FoodMenusImportReviewDecisionAction;
}

export interface DecideFoodMenusImportReviewResponse {
  readonly review: FoodMenusImportReviewRecord;
  readonly item: unknown;
}

export async function decideFoodMenusImportReview(
  restaurantId: string,
  request: DecideFoodMenusImportReviewRequest,
): Promise<DecideFoodMenusImportReviewResponse> {
  return fetchJson<DecideFoodMenusImportReviewResponse>(
    `${baseUrl(restaurantId)}/import-review/${encodeURIComponent(request.reviewId)}/decision`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: request.action }),
    },
  );
}
