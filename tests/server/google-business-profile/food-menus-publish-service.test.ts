import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getFoodMenusMock = vi.hoisted(() => vi.fn());
const updateFoodMenusMock = vi.hoisted(() => vi.fn());
const prepareProjectionMock = vi.hoisted(() => vi.fn());
const finishAttemptMock = vi.hoisted(() => vi.fn());
const markAttemptRunningMock = vi.hoisted(() => vi.fn());
const openAttemptMock = vi.hoisted(() => vi.fn());
const recordSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/client', () => ({
  getGoogleBusinessProfileFoodMenus: getFoodMenusMock,
  updateGoogleBusinessProfileFoodMenus: updateFoodMenusMock,
}));

vi.mock('@/server/google-business-profile/food-menus-projection-service', () => ({
  prepareFoodMenusProjection: prepareProjectionMock,
}));

vi.mock('@/server/google-business-profile/food-menus-storage', () => ({
  finishFoodMenusPublishAttempt: finishAttemptMock,
  markFoodMenusPublishAttemptRunning: markAttemptRunningMock,
  openFoodMenusPublishAttempt: openAttemptMock,
  recordFoodMenusSnapshot: recordSnapshotMock,
}));

import {
  canonicalizeGoogleFoodMenusResource,
  hashGoogleFoodMenusResource,
  type GoogleFoodMenusResource,
} from '@/server/google-business-profile/food-menus';
import { publishFoodMenusProjectionToGoogle } from '@/server/google-business-profile/food-menus-publish-service';

const FIXED_NOW = '2026-07-11T12:00:00.000Z';
const FOOD_MENUS_NAME = 'accounts/1/locations/2/foodMenus';

const client = { db: 'client' } as never;

const currentGoogleFoodMenus: GoogleFoodMenusResource = {
  name: FOOD_MENUS_NAME,
  menus: [
    {
      labels: [{ displayName: 'Dinner', languageCode: 'en' }],
      sections: [
        {
          labels: [{ displayName: 'Mains', languageCode: 'en' }],
          items: [
            {
              labels: [{ displayName: 'Momo', languageCode: 'en' }],
              attributes: { price: { currencyCode: 'GBP', units: '8', nanos: 0 } },
            },
          ],
        },
      ],
    },
  ],
};

const projectedFoodMenus: GoogleFoodMenusResource = {
  name: FOOD_MENUS_NAME,
  menus: [
    {
      labels: [{ displayName: 'Dinner', languageCode: 'en' }],
      sections: [
        {
          labels: [{ displayName: 'Mains', languageCode: 'en' }],
          items: [
            {
              labels: [{ displayName: 'Momo', languageCode: 'en' }],
              attributes: { price: { currencyCode: 'GBP', units: '9', nanos: 0 } },
            },
          ],
        },
      ],
    },
  ],
};

const baselineHash = hashGoogleFoodMenusResource(currentGoogleFoodMenus);

const preparedProjection = {
  localItemCount: 1,
  projection: { foodMenus: projectedFoodMenus, identities: [], skippedItems: [] },
  projectionHash: 'projection-hash-1',
  snapshot: { id: 'snap-projection' },
  identities: [],
};

function publish(overrides: Record<string, unknown> = {}) {
  return publishFoodMenusProjectionToGoogle({
    client,
    restaurantId: 'rest-1',
    accessToken: 'token-1',
    foodMenusName: FOOD_MENUS_NAME,
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
  for (const mock of [
    getFoodMenusMock,
    updateFoodMenusMock,
    prepareProjectionMock,
    finishAttemptMock,
    markAttemptRunningMock,
    openAttemptMock,
    recordSnapshotMock,
  ]) {
    mock.mockReset();
  }
  getFoodMenusMock.mockResolvedValue(currentGoogleFoodMenus);
  updateFoodMenusMock.mockResolvedValue(projectedFoodMenus);
  prepareProjectionMock.mockResolvedValue(preparedProjection);
  openAttemptMock.mockResolvedValue({ id: 'attempt-1', status: 'preflight' });
  markAttemptRunningMock.mockResolvedValue({ id: 'attempt-1', status: 'running' });
  finishAttemptMock.mockImplementation(async ({ status }: { status: string }) => ({
    id: 'attempt-1',
    status,
  }));
  recordSnapshotMock
    .mockResolvedValueOnce({ id: 'snap-baseline' })
    .mockResolvedValueOnce({ id: 'snap-after-publish' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('publishFoodMenusProjectionToGoogle', () => {
  it('publishes the prepared projection and records baseline plus post-publish snapshots @contract @external-mock', async () => {
    const result = await publish();

    expect(prepareProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        foodMenusName: FOOD_MENUS_NAME,
        source: 'preflight',
        persist: true,
      }),
    );
    expect(getFoodMenusMock).toHaveBeenCalledWith('token-1', FOOD_MENUS_NAME, {
      readMask: ['name', 'menus'],
    });

    expect(recordSnapshotMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        snapshotKind: 'preflight',
        source: 'preflight',
        foodMenusName: FOOD_MENUS_NAME,
        rawFoodMenus: currentGoogleFoodMenus,
        canonicalFoodMenus: canonicalizeGoogleFoodMenusResource(currentGoogleFoodMenus),
        snapshotHash: baselineHash,
        pulledAt: FIXED_NOW,
      }),
    );
    expect(openAttemptMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'rest-1',
      foodMenusName: FOOD_MENUS_NAME,
      projectedPayload: projectedFoodMenus,
      projectedPayloadHash: 'projection-hash-1',
      baselineGoogleHash: baselineHash,
      projectionSnapshotId: 'snap-projection',
      baselineGoogleSnapshotId: 'snap-baseline',
      publishMode: 'manual',
      requestedByUserId: null,
    });
    expect(markAttemptRunningMock).toHaveBeenCalledWith({ client, attemptId: 'attempt-1' });
    expect(updateFoodMenusMock).toHaveBeenCalledWith('token-1', projectedFoodMenus, {
      updateMask: ['menus'],
    });
    expect(finishAttemptMock).toHaveBeenCalledWith({
      client,
      attemptId: 'attempt-1',
      status: 'succeeded',
      googleResponse: projectedFoodMenus,
    });
    expect(recordSnapshotMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        snapshotKind: 'google_pull',
        source: 'publish',
        rawFoodMenus: projectedFoodMenus,
        snapshotHash: hashGoogleFoodMenusResource(projectedFoodMenus),
        pulledAt: FIXED_NOW,
      }),
    );

    expect(result).toEqual({
      projection: preparedProjection,
      baselineGoogleSnapshot: { id: 'snap-baseline' },
      baselineGoogleHash: baselineHash,
      attempt: { id: 'attempt-1', status: 'succeeded' },
      googleResponse: projectedFoodMenus,
    });
  });

  it('publishes zero-menu payloads without special-casing empty data @contract @external-mock', async () => {
    const emptyGoogle = { name: FOOD_MENUS_NAME, menus: [] };
    const emptyProjection = {
      ...preparedProjection,
      snapshot: null,
      projection: { ...preparedProjection.projection, foodMenus: emptyGoogle },
    };
    getFoodMenusMock.mockResolvedValue(emptyGoogle);
    updateFoodMenusMock.mockResolvedValue(emptyGoogle);
    prepareProjectionMock.mockResolvedValue(emptyProjection);

    const result = await publish({ publishMode: 'scheduled', createdByUserId: 'user-9' });

    expect(result.baselineGoogleHash).toBe(hashGoogleFoodMenusResource(emptyGoogle));
    expect(openAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectionSnapshotId: null,
        publishMode: 'scheduled',
        requestedByUserId: 'user-9',
      }),
    );
    expect(result.attempt.status).toBe('succeeded');
  });

  it('fails preflight when Google changed since the expected baseline hash @contract @external-mock', async () => {
    const promise = publish({ expectedGoogleHash: 'stale-google-hash' });
    const error = await promise.then(
      () => {
        throw new Error('expected publish to reject');
      },
      (caught: unknown) => caught as Error & Record<string, unknown>,
    );

    expect(error.name).toBe('GBP_FOOD_MENUS_PREFLIGHT_CHANGED');
    expect(error.baselineGoogleHash).toBe(baselineHash);
    expect(error.expectedGoogleHash).toBe('stale-google-hash');
    expect(error.attempt).toEqual({ id: 'attempt-1', status: 'preflight_failed' });
    expect(error.baselineGoogleSnapshot).toEqual({ id: 'snap-baseline' });

    expect(finishAttemptMock).toHaveBeenCalledWith({
      client,
      attemptId: 'attempt-1',
      status: 'preflight_failed',
      errorCode: 'baseline_changed',
      errorMessage: 'Google FoodMenus changed since the expected baseline.',
    });
    expect(markAttemptRunningMock).not.toHaveBeenCalled();
    expect(updateFoodMenusMock).not.toHaveBeenCalled();
  });

  it('fails preflight when the local projection drifted from the expected hash @contract @external-mock', async () => {
    const error = await publish({
      expectedGoogleHash: baselineHash,
      expectedProjectionHash: 'stale-projection-hash',
    }).then(
      () => {
        throw new Error('expected publish to reject');
      },
      (caught: unknown) => caught as Error & Record<string, unknown>,
    );

    expect(error.name).toBe('GBP_FOOD_MENUS_PROJECTION_CHANGED');
    expect(error.projectionHash).toBe('projection-hash-1');
    expect(error.expectedProjectionHash).toBe('stale-projection-hash');
    expect(finishAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'preflight_failed', errorCode: 'projection_changed' }),
    );
    expect(updateFoodMenusMock).not.toHaveBeenCalled();
  });

  it('reports the baseline conflict first when both expected hashes are stale @contract @external-mock', async () => {
    await expect(
      publish({
        expectedGoogleHash: 'stale-google-hash',
        expectedProjectionHash: 'stale-projection-hash',
      }),
    ).rejects.toMatchObject({ name: 'GBP_FOOD_MENUS_PREFLIGHT_CHANGED' });

    expect(finishAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'baseline_changed' }),
    );
  });

  it('proceeds when both expected hashes match the current state @contract @external-mock', async () => {
    const result = await publish({
      expectedGoogleHash: baselineHash,
      expectedProjectionHash: 'projection-hash-1',
    });

    expect(result.attempt.status).toBe('succeeded');
    expect(updateFoodMenusMock).toHaveBeenCalledTimes(1);
  });

  it('finishes the attempt as failed and decorates named Google publish errors @contract @external-mock', async () => {
    const googleFailure = Object.assign(new Error('Google authorization failed'), {
      name: 'GBP_FORBIDDEN',
    });
    updateFoodMenusMock.mockRejectedValue(googleFailure);

    const error = await publish().then(
      () => {
        throw new Error('expected publish to reject');
      },
      (caught: unknown) => caught as Error & Record<string, unknown>,
    );

    expect(error).toBe(googleFailure);
    expect(error.attempt).toEqual({ id: 'attempt-1', status: 'failed' });
    expect(error.baselineGoogleHash).toBe(baselineHash);
    expect(error.googleResponse).toBeNull();
    expect(finishAttemptMock).toHaveBeenCalledWith({
      client,
      attemptId: 'attempt-1',
      status: 'failed',
      errorCode: 'GBP_FORBIDDEN',
      errorMessage: 'Google authorization failed',
    });
    // No post-publish snapshot is recorded on failure.
    expect(recordSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it('normalises non-Error publish rejections into a coded failure @contract @external-mock', async () => {
    updateFoodMenusMock.mockRejectedValue('quota blown');

    const error = await publish().then(
      () => {
        throw new Error('expected publish to reject');
      },
      (caught: unknown) => caught as Error & Record<string, unknown>,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GBP_FOOD_MENUS_PUBLISH_FAILED');
    expect(error.message).toBe('Unable to publish Google FoodMenus.');
    expect(finishAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'GBP_FOOD_MENUS_PUBLISH_FAILED',
        errorMessage: 'Unable to publish Google FoodMenus.',
      }),
    );
  });

  it('propagates baseline fetch failures before opening any attempt @contract @external-mock', async () => {
    const fetchFailure = Object.assign(new Error('Google Business Profile request failed'), {
      name: 'GBP_UPSTREAM_ERROR',
    });
    getFoodMenusMock.mockRejectedValue(fetchFailure);

    await expect(publish()).rejects.toBe(fetchFailure);

    expect(recordSnapshotMock).not.toHaveBeenCalled();
    expect(openAttemptMock).not.toHaveBeenCalled();
    expect(updateFoodMenusMock).not.toHaveBeenCalled();
  });
});
