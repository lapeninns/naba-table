import { describe, expect, it } from 'vitest';

import { computePayloadChecksum, hashPolicyVersion } from '@/server/capacity/v2/utils';

describe('capacity v2 stable hashing', () => {
  it('changes the policy version when nested service windows change', () => {
    const basePolicy = {
      timezone: 'Europe/London',
      serviceOrder: ['dinner'],
      services: {
        dinner: {
          label: 'Dinner',
          windows: [{ start: '18:00', end: '22:00' }],
          bufferMinutes: 15,
        },
      },
      turnBandsByOption: {
        dinner: [{ start: '18:00', end: '22:00', durationMinutes: 90 }],
      },
    };
    const changedPolicy = {
      ...basePolicy,
      services: {
        dinner: {
          ...basePolicy.services.dinner,
          windows: [{ start: '18:00', end: '23:00' }],
        },
      },
    };

    expect(hashPolicyVersion(basePolicy as never)).not.toBe(
      hashPolicyVersion(changedPolicy as never),
    );
  });

  it('changes checksums when nested array object fields change', () => {
    const basePayload = {
      tables: [
        { id: 'table-1', capacity: 4, active: true },
        { id: 'table-2', capacity: 2, active: true },
      ],
      adjacency: [{ from: 'table-1', to: 'table-2', movable: true }],
      holds: [{ tableId: 'table-1', expiresAt: '2026-05-16T18:00:00.000Z' }],
    };
    const changedPayload = {
      ...basePayload,
      adjacency: [{ from: 'table-1', to: 'table-2', movable: false }],
    };

    expect(computePayloadChecksum(basePayload)).not.toBe(computePayloadChecksum(changedPayload));
  });

  it('keeps object key order deterministic while preserving nested content', () => {
    expect(computePayloadChecksum({ b: 2, a: { y: 1, x: 0 } })).toBe(
      computePayloadChecksum({ a: { x: 0, y: 1 }, b: 2 }),
    );
  });
});
