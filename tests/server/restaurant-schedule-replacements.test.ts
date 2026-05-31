import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOccasionCatalogMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/occasions/catalog', () => ({
  getOccasionCatalog: getOccasionCatalogMock,
}));

import { updateOperatingHours } from '@/server/restaurants/operatingHours';
import { updateServicePeriods } from '@/server/restaurants/servicePeriods';

function failingRpcClient() {
  return {
    rpc: vi.fn().mockResolvedValue({ error: { message: 'replacement failed' } }),
    from: vi.fn(),
  };
}

describe('restaurant schedule replacement safety', () => {
  beforeEach(() => {
    getOccasionCatalogMock.mockReset();
    getOccasionCatalogMock.mockResolvedValue({
      definitions: [{ key: 'dinner' }, { key: 'lunch' }],
    });
  });

  it('uses the atomic operating-hours replacement RPC instead of delete-then-insert', async () => {
    const client = failingRpcClient();

    await expect(
      updateOperatingHours(
        '11111111-1111-4111-8111-111111111111',
        {
          weekly: [
            {
              dayOfWeek: 1,
              opensAt: '17:00',
              closesAt: '22:00',
              isClosed: false,
            },
          ],
          overrides: [],
        },
        client as never,
      ),
    ).rejects.toEqual({ message: 'replacement failed' });

    expect(client.rpc).toHaveBeenCalledWith('replace_restaurant_operating_hours', {
      p_restaurant_id: '11111111-1111-4111-8111-111111111111',
      p_rows: expect.arrayContaining([
        expect.objectContaining({
          restaurant_id: '11111111-1111-4111-8111-111111111111',
          day_of_week: 1,
        }),
      ]),
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('allows overnight operating-hours windows during replacement', async () => {
    const client = failingRpcClient();

    await expect(
      updateOperatingHours(
        '11111111-1111-4111-8111-111111111111',
        {
          weekly: [
            {
              dayOfWeek: 5,
              opensAt: '18:00',
              closesAt: '01:00',
              isClosed: false,
            },
          ],
          overrides: [],
        },
        client as never,
      ),
    ).rejects.toEqual({ message: 'replacement failed' });

    expect(client.rpc).toHaveBeenCalledWith('replace_restaurant_operating_hours', {
      p_restaurant_id: '11111111-1111-4111-8111-111111111111',
      p_rows: expect.arrayContaining([
        expect.objectContaining({
          day_of_week: 5,
          opens_at: '18:00',
          closes_at: '01:00',
        }),
      ]),
    });
  });

  it('rejects duplicate operating-hours override ids before replacement', async () => {
    const client = failingRpcClient();
    const duplicateId = '22222222-2222-4222-8222-222222222222';

    await expect(
      updateOperatingHours(
        '11111111-1111-4111-8111-111111111111',
        {
          weekly: [],
          overrides: [
            {
              id: duplicateId,
              effectiveDate: '2026-07-01',
              opensAt: '17:00',
              closesAt: '22:00',
            },
            {
              id: duplicateId,
              effectiveDate: '2026-07-02',
              opensAt: '17:00',
              closesAt: '22:00',
            },
          ],
        },
        client as never,
      ),
    ).rejects.toThrow(/Duplicate operating-hours override id/);

    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('uses the atomic service-period replacement RPC instead of delete-then-insert', async () => {
    const client = failingRpcClient();

    await expect(
      updateServicePeriods(
        '11111111-1111-4111-8111-111111111111',
        [
          {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Dinner',
            dayOfWeek: 1,
            startTime: '17:00',
            endTime: '22:00',
            bookingOption: 'dinner',
          },
        ],
        client as never,
      ),
    ).rejects.toEqual({ message: 'replacement failed' });

    expect(client.rpc).toHaveBeenCalledWith('replace_restaurant_service_periods', {
      p_restaurant_id: '11111111-1111-4111-8111-111111111111',
      p_rows: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          restaurant_id: '11111111-1111-4111-8111-111111111111',
          name: 'Dinner',
          day_of_week: 1,
          start_time: '17:00',
          end_time: '22:00',
          booking_option: 'dinner',
        },
      ],
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects duplicate service period ids before replacement', async () => {
    const client = failingRpcClient();
    const duplicateId = '33333333-3333-4333-8333-333333333333';

    await expect(
      updateServicePeriods(
        '11111111-1111-4111-8111-111111111111',
        [
          {
            id: duplicateId,
            name: 'Lunch',
            dayOfWeek: 1,
            startTime: '12:00',
            endTime: '14:00',
            bookingOption: 'lunch',
          },
          {
            id: duplicateId,
            name: 'Dinner',
            dayOfWeek: 1,
            startTime: '17:00',
            endTime: '22:00',
            bookingOption: 'dinner',
          },
        ],
        client as never,
      ),
    ).rejects.toThrow(/Duplicate service period id/);

    expect(client.rpc).not.toHaveBeenCalled();
  });
});
