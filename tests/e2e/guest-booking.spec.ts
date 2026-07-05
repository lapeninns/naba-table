import { expect, test, type Locator, type Page } from '@playwright/test';

const appBaseUrl = `http://localhost:${process.env.QA_APP_PORT ?? '5180'}`;
const restaurantSlug = process.env.QA_PUBLIC_BOOKING_RESTAURANT_SLUG ?? 'qa-public-booking';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const bookingReference = 'NB1234';
const bookingTime = '12:30';
const bookingTimeLabel = '12:30 PM';

const formatDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const bookingDate = process.env.QA_PUBLIC_BOOKING_DATE ?? formatDateKey(addDays(new Date(), 1));

test.use({ baseURL: appBaseUrl });

const clickClientControl = async (locator: Locator) => {
  await locator.waitFor({ state: 'visible' });
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('Expected an HTMLElement control');
    }
    element.click();
  });
};

const waitForDevServerIdle = async (page: Page) => {
  await expect(page.getByText('Compiling')).toHaveCount(0, { timeout: 30_000 });
};

const seedBookingDraft = async (page: Page) => {
  await page.addInitScript(
    ({ date, slug, time }) => {
      const now = Date.now();
      const details = {
        bookingId: null,
        restaurantId: '',
        restaurantSlug: slug,
        restaurantName: '',
        restaurantAddress: '',
        restaurantTimezone: '',
        reservationDurationMinutes: 90,
        date,
        time,
        party: 1,
        bookingType: 'lunch',
        notes: '',
        name: '',
        email: '',
        phone: '',
        rememberDetails: false,
        agree: true,
        marketingOptIn: false,
      };
      window.localStorage.setItem(
        `reserve.wizard.draft.${slug}`,
        JSON.stringify({
          version: 1,
          savedAt: now,
          expiresAt: now + 6 * 60 * 60 * 1000,
          details,
        }),
      );
    },
    { date: bookingDate, slug: restaurantSlug, time: bookingTime },
  );
};

test('@p0 @browser @local-only @external-mock guest can complete a booking flow', async ({
  page,
}) => {
  await page.route('**/api/restaurants/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/calendar-mask')) {
      const from = url.searchParams.get('from') ?? bookingDate;
      const to = url.searchParams.get('to') ?? bookingDate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timezone: 'Europe/London',
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
          timezone: 'Europe/London',
          intervalMinutes: 15,
          defaultDurationMinutes: 90,
          lastSeatingBufferMinutes: 0,
          window: { opensAt: '12:00', closesAt: '22:00' },
          isClosed: false,
          availableBookingOptions: ['lunch'],
          slots: [
            {
              value: bookingTime,
              display: bookingTimeLabel,
              periodId: null,
              periodName: 'Lunch',
              bookingOption: 'lunch',
              defaultBookingOption: 'lunch',
              availability: {
                services: {},
                labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
              },
              disabled: false,
            },
          ],
          occasionCatalog: [],
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
          timezone: 'Europe/London',
          logoUrl: null,
          googleMapUrl: null,
        },
      }),
    });
  });

  await page.route('**/api/bookings**', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookings: [] }),
      });
      return;
    }

    const submittedPayload = request.postDataJSON() as {
      bookingType?: unknown;
      date?: unknown;
      email?: unknown;
      marketingOptIn?: unknown;
      name?: unknown;
      notes?: unknown;
      party?: unknown;
      phone?: unknown;
      restaurantId?: unknown;
      restaurantSlug?: unknown;
      time?: unknown;
    };
    const submittedDate =
      typeof submittedPayload.date === 'string' ? submittedPayload.date : bookingDate;
    const submittedTime =
      typeof submittedPayload.time === 'string' ? submittedPayload.time : bookingTime;
    const submittedParty = typeof submittedPayload.party === 'number' ? submittedPayload.party : 1;
    const submittedRestaurantId =
      typeof submittedPayload.restaurantId === 'string'
        ? submittedPayload.restaurantId
        : restaurantId;
    const submittedRestaurantSlug =
      typeof submittedPayload.restaurantSlug === 'string'
        ? submittedPayload.restaurantSlug
        : restaurantSlug;
    const submittedName =
      typeof submittedPayload.name === 'string' ? submittedPayload.name : 'Guest Booker';
    const submittedEmail =
      typeof submittedPayload.email === 'string' ? submittedPayload.email : 'guest@example.com';
    const submittedPhone =
      typeof submittedPayload.phone === 'string' ? submittedPayload.phone : '+441234567890';
    const submittedNotes =
      typeof submittedPayload.notes === 'string' ? submittedPayload.notes : null;
    const submittedMarketingOptIn =
      typeof submittedPayload.marketingOptIn === 'boolean'
        ? submittedPayload.marketingOptIn
        : false;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        booking: {
          id: bookingId,
          restaurant_id: submittedRestaurantId,
          booking_date: submittedDate,
          start_time: submittedTime,
          end_time: '14:00',
          booking_type: 'lunch',
          seating_preference: 'indoor',
          status: 'confirmed',
          party_size: submittedParty,
          customer_name: submittedName,
          customer_email: submittedEmail,
          customer_phone: submittedPhone,
          marketing_opt_in: submittedMarketingOptIn,
          notes: submittedNotes,
          reference: bookingReference,
          restaurants: {
            name: 'The Fox',
            slug: submittedRestaurantSlug,
            timezone: 'Europe/London',
          },
        },
        bookings: [
          {
            id: bookingId,
            restaurant_id: submittedRestaurantId,
            booking_date: submittedDate,
            start_time: submittedTime,
            end_time: '14:00',
            booking_type: 'lunch',
            seating_preference: 'indoor',
            status: 'confirmed',
            party_size: submittedParty,
            customer_name: submittedName,
            customer_email: submittedEmail,
            customer_phone: submittedPhone,
            marketing_opt_in: submittedMarketingOptIn,
            notes: submittedNotes,
            reference: bookingReference,
            restaurants: {
              name: 'The Fox',
              slug: submittedRestaurantSlug,
              timezone: 'Europe/London',
            },
          },
        ],
      }),
    });
  });

  await seedBookingDraft(page);
  await page.goto(`/restaurants/${restaurantSlug}/book`);
  await waitForDevServerIdle(page);

  await clickClientControl(page.getByRole('combobox', { name: 'Time' }));
  await clickClientControl(page.getByRole('option', { name: bookingTimeLabel }));

  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await clickClientControl(page.getByTestId('wizard-action-plan-continue'));

  await page.getByLabel('Full name').fill('Guest Booker');
  await page.getByLabel('Email address').fill('guest@example.com');
  await page.getByLabel('UK phone number').fill('+441234567890');

  await clickClientControl(page.getByTestId('wizard-action-details-review'));
  await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
  await clickClientControl(page.getByTestId('wizard-action-review-confirm'));

  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
  await expect(page.getByText(bookingReference)).toBeVisible();
});

test('@p0 @browser @local-only @external-mock guest sees a friendly duplicate-booking error instead of a raw code', async ({
  page,
}) => {
  await page.route('**/api/restaurants/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/calendar-mask')) {
      const from = url.searchParams.get('from') ?? bookingDate;
      const to = url.searchParams.get('to') ?? bookingDate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          timezone: 'Europe/London',
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
          timezone: 'Europe/London',
          intervalMinutes: 15,
          defaultDurationMinutes: 90,
          lastSeatingBufferMinutes: 0,
          window: { opensAt: '12:00', closesAt: '22:00' },
          isClosed: false,
          availableBookingOptions: ['lunch'],
          slots: [
            {
              value: bookingTime,
              display: bookingTimeLabel,
              periodId: null,
              periodName: 'Lunch',
              bookingOption: 'lunch',
              defaultBookingOption: 'lunch',
              availability: {
                services: {},
                labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
              },
              disabled: false,
            },
          ],
          occasionCatalog: [],
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
          timezone: 'Europe/London',
          logoUrl: null,
          googleMapUrl: null,
        },
      }),
    });
  });

  await page.route('**/api/bookings**', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookings: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'DUPLICATE_RESOURCE',
        error: 'duplicate key value violates unique constraint',
      }),
    });
  });

  await seedBookingDraft(page);
  await page.goto(`/restaurants/${restaurantSlug}/book`);
  await waitForDevServerIdle(page);

  await clickClientControl(page.getByRole('combobox', { name: 'Time' }));
  await clickClientControl(page.getByRole('option', { name: bookingTimeLabel }));
  await clickClientControl(page.getByTestId('wizard-action-plan-continue'));

  await page.getByLabel('Full name').fill('Guest Booker');
  await page.getByLabel('Email address').fill('guest@example.com');
  await page.getByLabel('UK phone number').fill('+441234567890');

  await clickClientControl(page.getByTestId('wizard-action-details-review'));
  await expect(page.getByRole('heading', { name: 'Review the booking' })).toBeVisible();
  await clickClientControl(page.getByTestId('wizard-action-review-confirm'));

  await expect(
    page.getByText(
      'Your email or phone number matches a previous guest, but not both. Please book with the same email address and phone number you used before, or call the restaurant for help.',
    ),
  ).toBeVisible();
  await expect(page.getByText('DUPLICATE_RESOURCE')).toHaveCount(0);
});
