import { describe, expect, it } from 'vitest';

import {
  attachManualHoldCreatorProfiles,
  getManualHoldCreatorIds,
  hydrateManualAssignmentContextHolds,
} from '@/server/capacity/table-assignment/manual-context-holds';

import type { TableHold } from '@/server/capacity/holds';

function makeHold(overrides: Partial<TableHold> & { id: string }): TableHold {
  const createdBy = Object.prototype.hasOwnProperty.call(overrides, 'createdBy')
    ? (overrides.createdBy ?? null)
    : 'user-1';

  return {
    id: overrides.id,
    bookingId: overrides.bookingId ?? 'booking-1',
    restaurantId: overrides.restaurantId ?? 'restaurant-1',
    zoneId: overrides.zoneId ?? 'zone-1',
    tableIds: overrides.tableIds ?? ['table-1'],
    startAt: overrides.startAt ?? '2026-05-23T18:00:00Z',
    endAt: overrides.endAt ?? '2026-05-23T19:30:00Z',
    expiresAt: overrides.expiresAt ?? '2026-05-23T18:10:00Z',
    createdBy,
    metadata: overrides.metadata ?? null,
  };
}

describe('manual assignment context holds', () => {
  it('deduplicates non-empty hold creator ids', () => {
    expect(
      getManualHoldCreatorIds([
        makeHold({ id: 'hold-1', createdBy: 'user-2' }),
        makeHold({ id: 'hold-2', createdBy: 'user-1' }),
        makeHold({ id: 'hold-3', createdBy: 'user-2' }),
        makeHold({ id: 'hold-4', createdBy: null }),
      ]),
    ).toEqual(['user-2', 'user-1']);
  });

  it('attaches creator names and emails to context holds', () => {
    const holds = [
      makeHold({ id: 'hold-1', createdBy: 'user-1' }),
      makeHold({ id: 'hold-2', createdBy: 'missing-user' }),
    ];

    expect(
      attachManualHoldCreatorProfiles({
        creators: [{ id: 'user-1', name: 'Alex Manager', email: 'alex@example.com' }],
        holds,
      }),
    ).toEqual([
      {
        ...holds[0],
        createdByName: 'Alex Manager',
        createdByEmail: 'alex@example.com',
      },
      {
        ...holds[1],
        createdByName: null,
        createdByEmail: null,
      },
    ]);
  });

  it('loads each creator profile once when hydrating holds', async () => {
    const queriedIds: string[][] = [];
    const client = {
      from: (table: string) => {
        expect(table).toBe('profiles');
        return {
          select: (columns: string) => {
            expect(columns).toBe('id, name, email');
            return {
              in: async (column: string, ids: string[]) => {
                expect(column).toBe('id');
                queriedIds.push(ids);
                return {
                  data: [{ id: 'user-1', name: 'Taylor Lead', email: 'taylor@example.com' }],
                  error: null,
                };
              },
            };
          },
        };
      },
    } as never;

    const hydrated = await hydrateManualAssignmentContextHolds({
      client,
      holds: [
        makeHold({ id: 'hold-1', createdBy: 'user-1' }),
        makeHold({ id: 'hold-2', createdBy: 'user-1' }),
      ],
    });

    expect(queriedIds).toEqual([['user-1']]);
    expect(hydrated.map((hold) => hold.createdByName)).toEqual(['Taylor Lead', 'Taylor Lead']);
  });

  it('skips profile lookup when there are no holds', async () => {
    const client = {
      from: () => {
        throw new Error('profile lookup should not run');
      },
    } as never;

    await expect(hydrateManualAssignmentContextHolds({ client, holds: [] })).resolves.toEqual([]);
  });

  it('falls back to null creator fields when profile lookup fails', async () => {
    const client = {
      from: () => ({
        select: () => ({
          in: async () => ({ data: null, error: new Error('lookup failed') }),
        }),
      }),
    } as never;

    const [hydrated] = await hydrateManualAssignmentContextHolds({
      client,
      holds: [makeHold({ id: 'hold-1', createdBy: 'user-1' })],
    });

    expect(hydrated).toMatchObject({
      createdByName: null,
      createdByEmail: null,
    });
  });
});
