import { expect, test } from '@playwright/test';

const appBaseUrl = 'http://localhost:5180';

const harnessCases = [
  {
    path: '/dev/guest-bookings',
    heading: 'Upcoming plans and saved receipts.',
    proof: 'Choose a view',
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
});
