import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

const harnessCases = [
  {
    path: '/dev/guest-bookings',
    heading: 'Upcoming plans and saved receipts.',
    proof: 'White Horse',
  },
  {
    path: '/dev/guest-dashboard',
    heading: 'Your bookings',
    proof: 'Current reservation',
  },
  {
    path: '/dev/guest-profile',
    heading: 'Profile details',
    proof: 'Contact details',
  },
  {
    path: '/dev/guest-receipt',
    heading: 'Radix Luma Dining Room',
    proof: 'Reservation reference',
  },
  {
    path: '/dev/guest-booking-actions',
    heading: 'Old Crown Girton',
    proof: 'Guest Information',
  },
  {
    path: '/dev/guest-booking-capacity',
    heading: 'Review the booking',
    proof: 'Mock Capacity Response',
  },
  {
    path: '/dev/guest-booking-error',
    heading: 'Review the booking',
    proof:
      'Your email or phone number matches a previous guest, but not both. Please book with the same email address and phone number you used before, or call the restaurant for help.',
  },
  {
    path: '/dev/guest-booking-plan-alert',
    heading: 'Guest Booking Plan Alert',
    proof: 'Operating-hours note',
  },
  {
    path: '/dev/guest-booking-sunday-roast',
    heading: 'Sunday roast booking prototype',
    proof: 'This booking is for Sunday roast',
  },
];

test.describe('guest dev harnesses', () => {
  test.use({ baseURL: appBaseUrl });

  for (const { path, heading, proof } of harnessCases) {
    test(`${path} renders guest UI proof`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await expect(page.getByText(proof, { exact: false }).first()).toBeVisible();
    });
  }

  test('/dev/guest-booking-sunday-roast updates the staff preview', async ({ page }) => {
    await page.goto('/dev/guest-booking-sunday-roast', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('sunday-roast-harness')).toHaveAttribute('data-hydrated', 'true');

    const roastCheckbox = page.getByRole('checkbox', {
      name: 'This booking is for Sunday roast',
    });
    await roastCheckbox.click();
    await expect(roastCheckbox).toHaveAttribute('aria-checked', 'true');

    const staffPreview = page.getByRole('complementary', { name: 'Staff preview' });
    await expect(staffPreview.getByText('Sunday Roast', { exact: true }).first()).toBeVisible();
    await expect(
      staffPreview.getByText('Roast covers').locator('..').getByText('4', { exact: true }),
    ).toBeVisible();

    await page.getByRole('radio', { name: 'Weekday' }).click();
    await expect(
      page.getByText('The Sunday roast control stays hidden in the real booking flow.'),
    ).toBeVisible();
  });
});
