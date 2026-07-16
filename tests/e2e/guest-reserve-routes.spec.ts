import { expect, test, type Page } from '@playwright/test';

import { buildFutureBookingDate } from './helpers/future-booking';

const restaurantSlug = 'the-fox';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const bookingReference = 'NB1234';
const futureBooking = buildFutureBookingDate();
const bookingDate = futureBooking.isoDate;
const bookingStartTime = '19:00';
const bookingEndTime = '20:30';
const bookingStartIso = futureBooking.startIsoUtc;
const bookingEndIso = futureBooking.endIsoUtc;
const restaurantTimezone = 'Europe/London';
let createBookingMode: 'capacity' | 'success' = 'success';

const bookingPayload = {
  id: bookingId,
  restaurant_id: restaurantId,
  booking_date: bookingDate,
  start_time: bookingStartTime,
  end_time: bookingEndTime,
  start_at: bookingStartIso,
  end_at: bookingEndIso,
  booking_type: 'dinner',
  seating_preference: 'indoor',
  status: 'confirmed',
  party_size: 2,
  customer_name: 'Guest Booker',
  customer_email: 'guest@example.com',
  customer_phone: '+441234567890',
  marketing_opt_in: false,
  notes: 'Window please',
  reference: bookingReference,
  restaurants: {
    name: 'The Fox',
    slug: restaurantSlug,
    timezone: restaurantTimezone,
  },
};

test.describe('reserve routes', () => {
  test.beforeEach(async ({ page }) => {
    createBookingMode = 'success';

    await page.route('**/api/restaurants**', async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname.endsWith('/calendar-mask')) {
        const from = url.searchParams.get('from') ?? bookingDate;
        const to = url.searchParams.get('to') ?? bookingDate;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            timezone: restaurantTimezone,
            from,
            to,
            closedDaysOfWeek: [],
            closedDates: [],
          }),
        });
        return;
      }

      if (url.pathname.endsWith('/schedule')) {
        const date = url.searchParams.get('date') ?? bookingDate;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            restaurantId,
            date,
            timezone: restaurantTimezone,
            intervalMinutes: 15,
            defaultDurationMinutes: 90,
            lastSeatingBufferMinutes: 0,
            window: { opensAt: '12:00', closesAt: '22:00' },
            isClosed: false,
            availableBookingOptions: ['dinner'],
            slots: [
              {
                value: '18:30',
                display: '6:30 PM',
                periodId: null,
                periodName: 'Dinner',
                bookingOption: 'dinner',
                defaultBookingOption: 'dinner',
                availability: {
                  services: {},
                  labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
                },
                disabled: false,
              },
              {
                value: bookingStartTime,
                display: '7:00 PM',
                periodId: null,
                periodName: 'Dinner',
                bookingOption: 'dinner',
                defaultBookingOption: 'dinner',
                availability: {
                  services: {},
                  labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
                },
                disabled: false,
              },
              {
                value: '20:00',
                display: '8:00 PM',
                periodId: null,
                periodName: 'Dinner',
                bookingOption: 'dinner',
                defaultBookingOption: 'dinner',
                availability: {
                  services: {},
                  labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
                },
                disabled: false,
              },
            ],
            occasionCatalog: [],
          }),
        });
        return;
      }

      if (url.pathname.endsWith('/api/restaurants')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: restaurantId,
                slug: restaurantSlug,
                name: 'The Fox',
                address: '1 High Street, London',
                timezone: restaurantTimezone,
                capacity: 80,
                bookingPolicy: 'You can cancel up to 24 hours before your reservation.',
                contactEmail: 'hello@thefox.test',
                contactPhone: '+441234567890',
                googleMapUrl: null,
                logoUrl: null,
                reservationIntervalMinutes: 15,
                reservationDefaultDurationMinutes: 90,
                reservationLastSeatingBufferMinutes: 0,
                reservationLifecycleGraceMinutes: 0,
                isActive: true,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          restaurant: {
            id: restaurantId,
            slug: restaurantSlug,
            name: 'The Fox',
            address: '1 High Street, London',
            phone: '+441234567890',
            email: 'hello@thefox.test',
            policy: 'You can cancel up to 24 hours before your reservation.',
            timezone: restaurantTimezone,
            logoUrl: null,
            googleMapUrl: null,
          },
        }),
      });
    });

    await page.route('**/api/bookings**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() !== 'POST') {
        if (url.pathname.endsWith(`/bookings/${bookingId}`)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ booking: bookingPayload }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ bookings: [] }),
        });
        return;
      }

      if (createBookingMode === 'capacity') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'CAPACITY_EXCEEDED',
            message: 'No tables are available at that time. Please choose another slot.',
            alternatives: [
              { time: '18:30', available: true, utilizationPercent: 72 },
              { time: '20:00', available: true, utilizationPercent: 61 },
            ],
            retryable: false,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          booking: bookingPayload,
          bookings: [bookingPayload],
        }),
      });
    });
  });

  async function chooseDefaultRestaurantSlot(page: Page) {
    await page.goto(`/r/${restaurantSlug}`);

    await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
    await expect(page.getByLabel('1 guest')).toBeVisible();

    await page.getByRole('button', { name: 'Increase guests' }).click();
    await expect(page.getByLabel('2 guests')).toBeVisible();

    const timeCombobox = page.getByRole('combobox', { name: 'Time' });

    await timeCombobox.click();
    await page.getByRole('option', { name: '7:00 PM' }).click();

    await expect(timeCombobox).toContainText('7:00 PM');
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  test('reserve root shows plan step', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
  });

  test('reserve new alias shows plan step', async ({ page }) => {
    await page.goto('/new');
    await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
  });

  test('@p1 @browser @contract @local-only loads wizard utilities and privacy navigation in the standalone app', async ({
    page,
  }) => {
    // Given the real standalone Reserve entrypoint at a mobile-first width
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/r/${restaurantSlug}`);

    // When the Plan step renders and its optional notes accordion opens
    const planGrid = page.locator('form > .grid').first();
    const notesTrigger = page.getByRole('button', {
      name: /add dietary, access, or occasion notes/i,
    });
    await notesTrigger.click();
    const notesContent = notesTrigger.locator('xpath=../following-sibling::*[1]');

    // Then Tailwind layout and accordion animation utilities are active at runtime
    await expect(planGrid).toHaveCSS('display', 'grid');
    await expect(notesContent).toHaveAttribute('data-state', 'open');
    await expect
      .poll(async () => notesContent.evaluate((element) => getComputedStyle(element).animationName))
      .not.toBe('none');
    await page.screenshot({
      path: 'test-results/browser-proof/reserve-wizard/after-plan-mobile.png',
      fullPage: true,
    });

    // When the guest reaches Details and activates the privacy notice
    await chooseDefaultRestaurantSlot(page);
    const privacyLink = page.getByRole('link', { name: /privacy notice/i });

    // Then it is a normal cross-surface link and changes the browser location
    await expect(privacyLink).toHaveAttribute('href', '/privacy');
    await privacyLink.click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('@p1 @browser @contract @local-only keeps Details consent explicit, supports email-only contact, and follows system dark mode', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 375, height: 812 });
    await chooseDefaultRestaurantSlot(page);

    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    const terms = page.getByRole('checkbox', { name: /I agree to the terms/ });
    await expect(terms).toBeVisible();
    await expect(terms).not.toBeChecked();
    await expect(page.getByRole('button', { name: /Preferences/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await page.getByLabel('Full name').fill('Email Only Guest');
    await page.getByLabel('Email address').fill('email.only@example.com');
    const phoneInput = page.getByRole('textbox', { name: 'UK phone number' });
    await expect(phoneInput).toHaveValue('');
    await expect(page.getByLabel('Full name')).toHaveCSS('height', '44px');
    await expect(page.getByLabel('Email address')).toHaveCSS('height', '44px');
    await expect(phoneInput).toHaveCSS('height', '44px');
    await terms.check();
    await page.screenshot({
      path: 'test-results/browser-proof/reserve-wizard/after-details-mobile.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Review booking' }).click();

    await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
    await expect(page.getByText('Email Only Guest')).toBeVisible();
    await expect(page.getByText('Not provided')).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
    await page.screenshot({
      path: 'test-results/browser-proof/reserve-wizard/after-review-desktop.png',
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan (1 of 4)' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Review (3 of 4)' })).toHaveCount(0);
  });

  test('restaurant-scoped reserve flow updates party size and selected slot', async ({ page }) => {
    await page.goto(`/r/${restaurantSlug}`);

    await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
    await expect(page.getByLabel('1 guest')).toBeVisible();

    await page.getByRole('button', { name: 'Increase guests' }).click();

    await expect(page.getByLabel('2 guests')).toBeVisible();

    const timeCombobox = page.getByRole('combobox', { name: 'Time' });

    await timeCombobox.click();
    await page.getByRole('option', { name: '7:00 PM' }).click();

    await expect(timeCombobox).toContainText('7:00 PM');
  });

  test('@p2 @browser @contract @local-only validates details and shows capacity alternatives before creating a reservation', async ({
    page,
  }) => {
    createBookingMode = 'capacity';
    await page.setViewportSize({ width: 375, height: 812 });

    await chooseDefaultRestaurantSlot(page);

    await expect(page.getByRole('heading', { name: 'Tell us how to reach you' })).toBeVisible();

    await page.getByLabel('Full name').fill('A');
    await expect(page.getByText('Please enter at least two characters.')).toBeVisible();
    await page.getByLabel('Full name').fill('Reserve Guest');

    await page.getByLabel('Email address').fill('not-an-email');
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    await page.getByLabel('Email address').fill('reserve.guest@example.com');

    const phoneInput = page.getByRole('textbox', { name: 'UK phone number' });
    await phoneInput.fill('12345');
    await expect(page.getByText(/Please enter a valid UK phone number/)).toBeVisible();
    const whatsappPreference = page.getByRole('checkbox', {
      name: /Use WhatsApp for booking messages and one review request/,
    });
    await expect(whatsappPreference).toBeDisabled();

    await phoneInput.fill('07123 456789');
    await expect(whatsappPreference).toBeEnabled();
    await expect(page.getByText('Booking confirmation and updates')).toBeVisible();
    await expect(page.getByText('Guest or venue cancellations')).toBeVisible();
    await expect(page.getByText('One post-visit review request')).toBeVisible();
    await expect(page.getByText(/from Nabatable on behalf of The Fox/)).toBeVisible();
    await expect(page.getByText(/Review requests never fall back to SMS/)).toBeVisible();
    await phoneInput.focus();
    await page.keyboard.press('Tab');
    await expect(whatsappPreference).toBeFocused();
    const checkboxBox = await whatsappPreference.boundingBox();
    expect(checkboxBox?.width).toBeGreaterThanOrEqual(44);
    expect(checkboxBox?.height).toBeGreaterThanOrEqual(44);
    await whatsappPreference.scrollIntoViewIfNeeded();
    const stickyNavigation = page.locator('[data-booking-wizard-navigation]');
    await stickyNavigation.evaluate((element) => element.setAttribute('style', 'display: none'));
    await page.screenshot({
      path: '.omo/evidence/task-2-whatsapp-review-production-release-375.png',
    });
    await stickyNavigation.evaluate((element) => element.removeAttribute('style'));

    await expect(whatsappPreference).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(whatsappPreference).toBeChecked();
    await phoneInput.fill('07123 456780');
    await expect(whatsappPreference).not.toBeChecked();
    await whatsappPreference.check();
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(whatsappPreference).toBeVisible();

    const terms = page.getByRole('checkbox', { name: /I agree to the terms/ });
    await expect(terms).not.toBeChecked();
    await terms.check();

    await page.getByRole('button', { name: 'Review booking' }).click();

    await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
    await expect(page.getByText('Reserve Guest')).toBeVisible();
    await expect(page.getByText('reserve.guest@example.com')).toBeVisible();
    await expect(
      page.getByText(
        'WhatsApp booking messages + one post-visit review request · SMS backup for booking messages',
      ),
    ).toBeVisible();
    await stickyNavigation.evaluate((element) => element.setAttribute('style', 'display: none'));
    await page.screenshot({
      path: '.omo/evidence/task-2-whatsapp-review-production-release-768.png',
      fullPage: true,
    });
    await stickyNavigation.evaluate((element) => element.removeAttribute('style'));

    await page.getByRole('button', { name: 'Confirm booking' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'No tables are available at that time. Please choose another slot.',
    );
    await expect(page.getByText('Nearby availability')).toBeVisible();

    await page.getByRole('button', { name: '18:30' }).click();

    await expect(page.getByRole('heading', { name: 'Plan your table' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Time' })).toContainText('6:30 PM');
  });

  test('reserve reservation details stub renders id', async ({ page }) => {
    await page.goto('/resv-test-123');
    await expect(page.getByRole('heading', { name: 'Reservation resv-test-123' })).toBeVisible();
    await expect(page.getByText('Details view coming soon.')).toBeVisible();
  });

  test('reserve not found route shows guidance', async ({ page }) => {
    await page.goto('/missing/path');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to reservations' })).toBeVisible();
  });
});
