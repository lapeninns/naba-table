import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateRestaurantMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/update', () => ({
  updateRestaurant: updateRestaurantMock,
}));

import { updateRestaurantDetails } from '@/server/restaurants/details';

const updatedRestaurant = {
  id: 'restaurant-1',
  name: 'New Name',
  slug: 'old-slug',
  timezone: 'Europe/London',
  capacity: 80,
  contactEmail: 'pub@example.com',
  contactPhone: null,
  address: null,
  managerDailySummaryEnabled: false,
  managerNotificationPhone: null,
  googleMapUrl: null,
  googleReviewUrl: null,
  bookingPolicy: null,
  logoUrl: null,
  updatedAt: '2026-05-16T08:00:00.000Z',
};

function makeClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: { description: 'Current description' },
        error: null,
      })),
      upsert: vi.fn(async () => ({ error: null })),
    })),
  };
}

describe('updateRestaurantDetails', () => {
  beforeEach(() => {
    updateRestaurantMock.mockReset();
    updateRestaurantMock.mockResolvedValue(updatedRestaurant);
  });

  it('writes only provided core fields for partial details updates', async () => {
    const client = makeClient();

    await updateRestaurantDetails('restaurant-1', { name: ' New Name ' }, client as never);

    expect(updateRestaurantMock).toHaveBeenCalledWith('restaurant-1', { name: 'New Name' }, client);
    expect(client.from).not.toHaveBeenCalledWith('restaurants');
  });

  it('keeps null clears explicit without expanding omitted fields', async () => {
    const client = makeClient();

    await updateRestaurantDetails('restaurant-1', { contactEmail: null }, client as never);

    expect(updateRestaurantMock).toHaveBeenCalledWith(
      'restaurant-1',
      { contactEmail: null },
      client,
    );
  });
});

describe('updateRestaurantDetails business description', () => {
  beforeEach(() => {
    updateRestaurantMock.mockReset();
    updateRestaurantMock.mockResolvedValue({ ...updatedRestaurant, businessDescription: 'Cosy' });
  });

  it('writes the description with the restaurant row in one update, not a second upsert', async () => {
    const client = makeClient();

    const details = await updateRestaurantDetails(
      'restaurant-1',
      { name: 'New Name', businessDescription: '  Cosy ' },
      client as never,
    );

    expect(updateRestaurantMock).toHaveBeenCalledWith(
      'restaurant-1',
      { name: 'New Name', businessDescription: 'Cosy' },
      client,
    );
    expect(client.from).not.toHaveBeenCalled();
    expect(details.businessDescription).toBe('Cosy');
  });

  it('saves a description-only change through the same atomic update', async () => {
    const client = makeClient();

    await updateRestaurantDetails('restaurant-1', { businessDescription: null }, client as never);

    expect(updateRestaurantMock).toHaveBeenCalledWith(
      'restaurant-1',
      { businessDescription: null },
      client,
    );
    expect(client.from).not.toHaveBeenCalledWith('restaurant_business_details');
  });
});
