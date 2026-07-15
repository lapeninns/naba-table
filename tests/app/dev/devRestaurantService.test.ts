import { describe, expect, it } from 'vitest';

import { createDevRestaurantService } from '@/src/app/(public)/dev/_mocks/services/devRestaurantService';

describe('development restaurant service contract', () => {
  it('keeps restaurant state isolated and mutable through the public service contract', async () => {
    const service = createDevRestaurantService();
    const restaurants = await service.listRestaurants();

    expect(restaurants).toHaveLength(2);
    const primary = restaurants[0];
    expect(primary).toBeDefined();
    if (!primary) return;

    const updated = await service.updateProfile(primary.id, { name: 'Updated Dev Restaurant' });
    expect(updated.name).toBe('Updated Dev Restaurant');
    await expect(service.getProfile(primary.id)).resolves.toMatchObject({
      id: primary.id,
      name: 'Updated Dev Restaurant',
    });

    const hours = await service.getOperatingHours(primary.id);
    const nextHours = { ...hours, overrides: [] };
    await expect(service.updateOperatingHours(primary.id, nextHours)).resolves.toEqual(nextHours);
  });

  it('persists and resets email-template customizations', async () => {
    const service = createDevRestaurantService();
    const [primary] = await service.listRestaurants();
    expect(primary).toBeDefined();
    if (!primary) return;

    const snapshot = await service.getEmailTemplates(primary.id);
    const template = snapshot.groups[0]?.templates[0];
    expect(template).toBeDefined();
    if (!template) return;

    const customized = await service.updateEmailTemplate(primary.id, template.key, {
      variants: template.variants,
    });
    expect(customized.status).toBe('custom');

    const reset = await service.resetEmailTemplate(primary.id, template.key);
    expect(reset.status).toBe('default');
  });

  it('preserves stable unsupported-method errors', async () => {
    const service = createDevRestaurantService();

    await expect(service.getBusinessContext('restaurant-1')).rejects.toThrow(
      '[dev][restaurantService] getBusinessContext is not implemented',
    );
  });
});
