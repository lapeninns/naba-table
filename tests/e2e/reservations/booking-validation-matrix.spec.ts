import { expect, test } from '@playwright/test';

type Category = {
  label: string; // substring in the time slot button label
  description: string; // human readable
};

const CATEGORIES: Category[] = [
  { label: 'Weekday Lunch', description: 'Lunch' },
  { label: 'Happy Hour', description: 'Drinks' },
  { label: 'Dinner Service', description: 'Dinner' },
];

async function gotoFirstRestaurant(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext) {
  const res = await request.get('/api/restaurants');
  expect(res.ok()).toBeTruthy();
  const payload = await res.json();
  const restaurants = Array.isArray(payload?.data) ? payload.data : [];
  test.skip(restaurants.length === 0, 'Requires at least one restaurant in Supabase.');
  const { slug } = restaurants[0] ?? {};
  test.skip(!slug, 'Restaurant slug required to run booking flow.');
  await page.goto(`/reserve/r/${slug}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: /Plan your visit/i, level: 2 })).toBeVisible({ timeout: 30000 });
}

async function openTimePanel(page: import('@playwright/test').Page) {
  // Expand the time/occasion/notes panel if not already open
  const trigger = page.getByRole('button', { name: /^Time, occasion & notes/i });
  if (await trigger.isVisible()) {
    await trigger.click();
  }
}

async function selectCategory(page: import('@playwright/test').Page, label: string) {
  // Choose a time within the category (button name includes the category label)
  const timeBtn = page.getByRole('button', { name: new RegExp(`,\s*${label}$`, 'i') }).first();
  const isVisible = await timeBtn.isVisible().catch(() => false);
  if (!isVisible) {
    return false;
  }
  await timeBtn.click();
  return true;
}

async function setPartySize(page: import('@playwright/test').Page, size: number) {
  // Normalize to 1 then increment to desired size
  const dec = page.getByLabel('Decrease guests');
  const inc = page.getByLabel('Increase guests');
  for (let i = 0; i < 12; i++) {
    await dec.click({ trial: true }).catch(() => {});
    try {
      await dec.click();
    } catch {
      break;
    }
  }
  for (let i = 1; i < size; i++) {
    await inc.click();
  }
}

async function assertNotesValidation(page: import('@playwright/test').Page) {
  // Overfill notes (>500 chars) and ensure Continue is disabled, then fix
  const notes = page.getByLabel('Notes');
  await notes.fill('A'.repeat(600));
  const continueBtn = page.getByRole('button', { name: /^Continue$/i });
  await expect(continueBtn).toBeDisabled();

  await notes.fill('Looks good');
  await expect(continueBtn).toBeEnabled();
}

async function assertContactValidations(page: import('@playwright/test').Page) {
  // Invalid entries
  await page.getByLabel('Full name').fill('A');
  await page.getByLabel('Email address').fill('invalid-email');
  await page.getByLabel('UK phone number').fill('123');

  // Review should be disabled when invalid
  const reviewBtn = page.getByRole('button', { name: /Review booking/i });
  await expect(reviewBtn).toBeDisabled();

  // Fix entries
  await page.getByLabel('Full name').fill(`Matrix Guest ${Date.now()}`);
  await page.getByLabel('Email address').fill(`matrix+${Date.now()}@example.com`);
  await page.getByLabel('UK phone number').fill('07123 456789');

  // Uncheck terms to assert disabled button
  const terms = page.getByLabel(/I agree to the terms and privacy notice/i);
  if (await terms.isChecked()) {
    await terms.uncheck();
  }
  await expect(reviewBtn).toBeDisabled();

  await terms.check();
  await expect(reviewBtn).toBeEnabled();
  await reviewBtn.click();

  await expect(page.getByRole('heading', { name: /Review and confirm/i })).toBeVisible();
}

async function confirmAndVerify(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Confirm booking/i }).click();
  await expect(page.getByRole('heading', { name: /Booking confirmed/i })).toBeVisible();
}

test.describe('booking validation matrix', () => {
  test('covers lunch, happy hour, dinner with validation checks', async ({ page, request }) => {
    await gotoFirstRestaurant(page, request);

    const partySizes = [1, 3, 4];
    for (const category of CATEGORIES) {
      // Reset to start for each category
      await gotoFirstRestaurant(page, request);
      await openTimePanel(page);
      const categorySelected = await selectCategory(page, category.label);
      if (!categorySelected) {
        continue;
      }

      for (const size of partySizes) {
        // For each party size, run the validation flow end-to-end
        await setPartySize(page, size);
        await assertNotesValidation(page);

        // Continue → Contact details
        await page.getByRole('button', { name: /^Continue$/i }).click();
        await expect(page.getByRole('heading', { name: /Tell us how to reach you/i })).toBeVisible();

        await assertContactValidations(page);
        await confirmAndVerify(page);

        // Start new booking to remain in same category for next size
        const newBooking = page.getByRole('button', { name: /Start a new booking/i });
        if (await newBooking.isVisible({ timeout: 5000 }).catch(() => false)) {
          await newBooking.click();
        } else {
          // If no button (e.g., redirected), navigate again
          await gotoFirstRestaurant(page, request);
          await openTimePanel(page);
          await selectCategory(page, category.label);
        }
      }
    }
  });
});
