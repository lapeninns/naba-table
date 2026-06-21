import { getGoogleBusinessProfileFoodMenus, updateGoogleBusinessProfileFoodMenus } from './client';
import {
  canonicalizeGoogleFoodMenusResource,
  hashGoogleFoodMenusResource,
  type GoogleFoodMenusResource,
} from './food-menus';
import {
  prepareFoodMenusProjection,
  type PreparedFoodMenusProjection,
  type PrepareFoodMenusProjectionInput,
} from './food-menus-projection-service';
import {
  finishFoodMenusPublishAttempt,
  markFoodMenusPublishAttemptRunning,
  openFoodMenusPublishAttempt,
  recordFoodMenusSnapshot,
  type FoodMenusPublishAttempt,
  type FoodMenusPublishMode,
  type FoodMenusSnapshot,
} from './food-menus-storage';
import {
  createFoodMenusBaselineChangedError,
  createFoodMenusProjectionChangedError,
  normalizeFoodMenusPublishFailure,
  resolveFoodMenusPublishPreflightHashDecision,
} from './food-menus-sync-domain';

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

  const preflightHashDecision = resolveFoodMenusPublishPreflightHashDecision({
    baselineGoogleHash,
    projectionHash: projection.projectionHash,
    expectedGoogleHash,
    expectedProjectionHash,
  });

  if (
    preflightHashDecision.status === 'failed' &&
    preflightHashDecision.kind === 'baseline_changed'
  ) {
    const finished = await finishFoodMenusPublishAttempt({
      client,
      attemptId: attempt.id,
      status: 'preflight_failed',
      errorCode: preflightHashDecision.errorCode,
      errorMessage: preflightHashDecision.errorMessage,
    });
    throw createFoodMenusBaselineChangedError({
      baselineGoogleHash: preflightHashDecision.baselineGoogleHash,
      expectedGoogleHash: preflightHashDecision.expectedGoogleHash,
      attempt: finished,
      baselineGoogleSnapshot,
      projection,
    });
  }

  if (
    preflightHashDecision.status === 'failed' &&
    preflightHashDecision.kind === 'projection_changed'
  ) {
    const finished = await finishFoodMenusPublishAttempt({
      client,
      attemptId: attempt.id,
      status: 'preflight_failed',
      errorCode: preflightHashDecision.errorCode,
      errorMessage: preflightHashDecision.errorMessage,
    });
    throw createFoodMenusProjectionChangedError({
      projectionHash: preflightHashDecision.projectionHash,
      expectedProjectionHash: preflightHashDecision.expectedProjectionHash,
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
    const normalized = normalizeFoodMenusPublishFailure(error);
    const failed = await finishFoodMenusPublishAttempt({
      client,
      attemptId: runningAttempt.id,
      status: 'failed',
      errorCode: normalized.errorCode,
      errorMessage: normalized.errorMessage,
    });
    throw Object.assign(normalized.publishError, {
      projection,
      baselineGoogleSnapshot,
      baselineGoogleHash,
      attempt: failed,
      googleResponse: null,
    });
  }
}
