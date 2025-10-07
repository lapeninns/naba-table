import { expect, test } from '@playwright/test';

type RestaurantSummary = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('restaurant browser mobile experience', () => {
  test('@mobile-smoke filters restaurants and opens booking CTA', async ({ page, request, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Runs only on the mobile viewport project.');
    test.skip(!baseURL, 'Base URL must be configured.');

    const restaurantsResponse = await request.get('/api/restaurants');
    expect(restaurantsResponse.ok()).toBeTruthy();

    const payload = await restaurantsResponse.json();
    const restaurants: RestaurantSummary[] = Array.isArray(payload?.data) ? payload.data : [];
    test.skip(restaurants.length < 2, 'Requires at least two restaurants in Supabase to validate search filtering.');

    const [firstRestaurant, targetRestaurant] = restaurants;
    const searchTerm = targetRestaurant.name.split(' ')[0] ?? targetRestaurant.name;

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Available restaurants/i })).toBeVisible();

    await page.getByLabel('Search').fill(searchTerm);

    const targetCta = page
      .getByRole('link', { name: `Start booking at ${targetRestaurant.name}` })
      .first();
    await expect(targetCta).toBeVisible();

    if (firstRestaurant?.id !== targetRestaurant.id) {
      const otherCta = page.getByRole('link', { name: `Start booking at ${firstRestaurant.name}` });
      await expect(otherCta).toHaveCount(0);
    }

    const minSeatsInput = page.getByLabel('Minimum seats');
    const exceedingCapacity = Math.max((targetRestaurant.capacity ?? 0) + 50, 50);

    await minSeatsInput.fill(String(exceedingCapacity));
    await expect(page.getByRole('heading', { name: /No restaurants available/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Contact Support/i })).toBeVisible();

    await minSeatsInput.fill('1');
    await expect(targetCta).toBeVisible();

    await targetCta.click();

    const slugPattern = escapeRegex(targetRestaurant.slug);
    await expect(page).toHaveURL(new RegExp(`/reserve/r/${slugPattern}`));
  });
});
