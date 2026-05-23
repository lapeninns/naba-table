import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  buildManualSoftHoldWindow,
  translateManualSoftHoldAcquisitionError,
  translateManualSoftHoldOwnershipError,
} from '@/server/capacity/table-assignment/manual-soft-holds';
import {
  SoftHoldConflictError,
  SoftHoldExpiredError,
} from '@/server/capacity/table-assignment/soft-holds';
import { ManualSelectionInputError } from '@/server/capacity/table-assignment/types';

import type { BookingWindow } from '@/server/capacity/table-assignment/types';

const window = {
  block: {
    start: DateTime.fromISO('2026-05-23T18:00:00.000Z'),
    end: DateTime.fromISO('2026-05-23T19:30:00.000Z'),
  },
} as BookingWindow;

describe('manual soft-holds', () => {
  it('serializes booking windows for soft-hold RPC calls', () => {
    expect(buildManualSoftHoldWindow(window)).toEqual({
      startAt: '2026-05-23T18:00:00',
      endAt: '2026-05-23T19:30:00',
    });
  });

  it('maps soft-hold conflicts to the stable manual selection error shape', () => {
    expect(() =>
      translateManualSoftHoldAcquisitionError(
        new SoftHoldConflictError(
          'blocked',
          [
            {
              tableId: 'table-2',
              blockingSession: 'session-1',
              blockingExpiresAt: null,
            },
          ],
          'session-2',
        ),
      ),
    ).toThrow(ManualSelectionInputError);

    try {
      translateManualSoftHoldAcquisitionError(
        new SoftHoldConflictError(
          'blocked',
          [
            {
              tableId: 'table-2',
              blockingSession: 'session-1',
              blockingExpiresAt: null,
            },
          ],
          'session-2',
        ),
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'SOFT_HOLD_CONFLICT',
        status: 409,
        message:
          'Table(s) table-2 are currently being selected by another operator. Please try again in a few seconds.',
      });
    }
  });

  it('maps generic acquisition failures to a stable unavailable error', () => {
    try {
      translateManualSoftHoldAcquisitionError(new Error('rpc failed'));
    } catch (error) {
      expect(error).toMatchObject({
        code: 'SOFT_HOLD_UNAVAILABLE',
        status: 503,
        message: 'Unable to acquire table lock. Please try again.',
      });
    }
  });

  it('maps expired ownership checks to a stable expired error', () => {
    try {
      translateManualSoftHoldOwnershipError(
        new SoftHoldExpiredError('expired', 'session-1', ['table-1']),
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'SOFT_HOLD_EXPIRED',
        status: 409,
        message: 'Your table selection has expired. Please re-select the tables.',
      });
    }
  });

  it('maps generic ownership failures to a stable verification error', () => {
    try {
      translateManualSoftHoldOwnershipError(new Error('ownership failed'));
    } catch (error) {
      expect(error).toMatchObject({
        code: 'SOFT_HOLD_VERIFICATION_FAILED',
        status: 503,
        message: 'Unable to verify table lock. Please re-select the tables.',
      });
    }
  });
});
