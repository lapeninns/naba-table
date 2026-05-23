import {
  acquireSoftHolds,
  checkSoftHoldOwnership,
  releaseSoftHolds,
  SoftHoldConflictError,
  SoftHoldExpiredError,
  type SoftHoldAcquisitionResult,
} from './soft-holds';
import { ManualSelectionInputError, type BookingWindow } from './types';
import { toIsoUtc } from './utils';

import type { DbClient } from './supabase';

export type { SoftHoldAcquisitionResult } from './soft-holds';

export type ManualSoftHoldWindow = {
  startAt: string;
  endAt: string;
};

export function buildManualSoftHoldWindow(window: BookingWindow): ManualSoftHoldWindow {
  return {
    startAt: toIsoUtc(window.block.start),
    endAt: toIsoUtc(window.block.end),
  };
}

export function translateManualSoftHoldAcquisitionError(error: unknown): never {
  if (error instanceof SoftHoldConflictError) {
    const blockedTableIds = error.blockedTables.map((table) => table.tableId);
    throw new ManualSelectionInputError(
      `Table(s) ${blockedTableIds.join(', ')} are currently being selected by another operator. Please try again in a few seconds.`,
      'SOFT_HOLD_CONFLICT',
      409,
    );
  }

  throw new ManualSelectionInputError(
    'Unable to acquire table lock. Please try again.',
    'SOFT_HOLD_UNAVAILABLE',
    503,
  );
}

export function translateManualSoftHoldOwnershipError(error: unknown): never {
  if (error instanceof SoftHoldExpiredError) {
    throw new ManualSelectionInputError(
      'Your table selection has expired. Please re-select the tables.',
      'SOFT_HOLD_EXPIRED',
      409,
    );
  }

  throw new ManualSelectionInputError(
    'Unable to verify table lock. Please re-select the tables.',
    'SOFT_HOLD_VERIFICATION_FAILED',
    503,
  );
}

export async function acquireManualSoftHolds({
  bookingId,
  client,
  restaurantId,
  tableIds,
  window,
}: {
  bookingId: string;
  client: DbClient;
  restaurantId: string;
  tableIds: string[];
  window: BookingWindow;
}): Promise<SoftHoldAcquisitionResult> {
  try {
    return await acquireSoftHolds({
      tableIds,
      window: buildManualSoftHoldWindow(window),
      restaurantId,
      bookingId,
      client,
    });
  } catch (error) {
    translateManualSoftHoldAcquisitionError(error);
  }
}

export async function verifyManualSoftHoldOwnership({
  client,
  sessionToken,
  tableIds,
  window,
}: {
  client: DbClient;
  sessionToken: string;
  tableIds: string[];
  window: BookingWindow;
}): Promise<void> {
  try {
    await checkSoftHoldOwnership({
      sessionToken,
      tableIds,
      window: buildManualSoftHoldWindow(window),
      client,
    });
  } catch (error) {
    translateManualSoftHoldOwnershipError(error);
  }
}

export async function releaseManualSoftHolds({
  client,
  onError,
  sessionToken,
}: {
  client: DbClient;
  onError?: (error: unknown) => void;
  sessionToken: string;
}): Promise<void> {
  await releaseSoftHolds({ sessionToken, client }).catch((error) => {
    onError?.(error);
  });
}

export async function releaseManualSoftHoldsQuietly({
  client,
  sessionToken,
}: {
  client: DbClient;
  sessionToken: string;
}): Promise<void> {
  await releaseManualSoftHolds({ sessionToken, client });
}
