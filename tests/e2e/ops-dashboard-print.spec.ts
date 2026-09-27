import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const appHostBaseUrl = `http://app.localhost:${appPort}`;
const qaAuthCookieName = '__nabatable_qa_ops_auth';
const qaAuthCookieValue = 'enabled';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const printDate = '2026-05-16';

const restaurant = {
  id: restaurantId,
  name: 'QA App Host Restaurant',
  slug: 'qa-app-host',
  isActive: true,
  timezone: 'Europe/London',
  capacity: 48,
  contactEmail: 'qa.ops@example.test',
  contactPhone: '+440000000000',
  address: '1 QA Street, Test Town',
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 30,
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  role: 'owner',
};

type FixtureBooking = {
  ref: string;
  name: string;
  status: string;
  start: string;
  end: string;
  party: number;
  tables: [string, string][];
  notes?: string;
  allergies?: string[];
  diet?: string[];
  phone?: string;
};

// A full Saturday: lunch and dinner, every status, shared tables, allergies and a walk-in.
// Names and phone numbers are placeholders.
const DAY: FixtureBooking[] = [
  {
    ref: 'QA-10411',
    name: 'R. Okafor',
    status: 'completed',
    start: '12:00',
    end: '13:45',
    party: 4,
    tables: [['5', 'Restaurant']],
    notes: 'High chair',
  },
  {
    ref: 'QA-10412',
    name: 'J. Hughes',
    status: 'completed',
    start: '12:00',
    end: '13:30',
    party: 2,
    tables: [['2', 'Restaurant']],
  },
  {
    ref: 'QA-10413',
    name: 'A. Kowalski',
    status: 'completed',
    start: '12:15',
    end: '14:00',
    party: 6,
    tables: [
      ['7', 'Restaurant'],
      ['8', 'Restaurant'],
    ],
    allergies: ['Peanuts'],
    notes: 'Birthday. Candle on dessert.',
  },
  {
    ref: 'QA-10414',
    name: 'T. Bennett',
    status: 'no_show',
    start: '12:30',
    end: '14:15',
    party: 3,
    tables: [['4', 'Restaurant']],
  },
  {
    ref: 'QA-10415',
    name: 'P. Singh',
    status: 'completed',
    start: '12:30',
    end: '14:00',
    party: 2,
    tables: [['3', 'Restaurant']],
    diet: ['Vegetarian'],
  },
  {
    ref: 'QA-10416',
    name: 'D. Fraser',
    status: 'completed',
    start: '13:00',
    end: '14:45',
    party: 8,
    tables: [
      ['10', 'Garden room'],
      ['11', 'Garden room'],
    ],
    allergies: ['Gluten', 'Sesame'],
    notes: 'Two wheelchair users. Use the step-free entrance.',
  },
  {
    ref: 'QA-10417',
    name: 'E. Lindqvist',
    status: 'cancelled',
    start: '13:15',
    end: '15:00',
    party: 4,
    tables: [['6', 'Restaurant']],
    notes: 'Cancelled by guest',
  },
  {
    ref: 'QA-10418',
    name: 'K. Adeyemi',
    status: 'completed',
    start: '13:30',
    end: '15:15',
    party: 5,
    tables: [['12', 'Garden room']],
  },
  {
    ref: 'QA-10419',
    name: 'C. Moreau',
    status: 'completed',
    start: '14:00',
    end: '15:30',
    party: 2,
    tables: [['1', 'Bar']],
    diet: ['Vegan'],
  },
  {
    ref: 'QA-10420',
    name: 'S. Walsh',
    status: 'checked_in',
    start: '17:00',
    end: '18:45',
    party: 4,
    tables: [['5', 'Restaurant']],
    notes: 'Asked for a window table',
  },
  {
    ref: 'QA-10421',
    name: '',
    status: 'checked_in',
    start: '17:10',
    end: '18:40',
    party: 2,
    tables: [['B2', 'Bar']],
  },
  {
    ref: 'QA-10422',
    name: 'H. Nakamura',
    status: 'checked_in',
    start: '17:30',
    end: '19:15',
    party: 2,
    tables: [['2', 'Restaurant']],
    allergies: ['Shellfish'],
  },
  {
    ref: 'QA-10423',
    name: 'G. Dimitriou',
    status: 'checked_in',
    start: '17:30',
    end: '19:30',
    party: 6,
    tables: [
      ['7', 'Restaurant'],
      ['8', 'Restaurant'],
    ],
    diet: ['Halal'],
  },
  {
    ref: 'QA-10424',
    name: 'L. Reid',
    status: 'checked_in',
    start: '18:00',
    end: '19:45',
    party: 3,
    tables: [['4', 'Restaurant']],
  },
  {
    ref: 'QA-10425',
    name: 'M. Castillo',
    status: 'checked_in',
    start: '18:15',
    end: '20:00',
    party: 2,
    tables: [['3', 'Restaurant']],
    notes: 'Anniversary',
  },
  {
    ref: 'QA-10426',
    name: 'F. Brennan',
    status: 'confirmed',
    start: '18:30',
    end: '20:15',
    party: 4,
    tables: [['6', 'Restaurant']],
  },
  {
    ref: 'QA-10427',
    name: 'Y. Haddad',
    status: 'confirmed',
    start: '18:45',
    end: '20:30',
    party: 2,
    tables: [['1', 'Bar']],
    allergies: ['Tree nuts'],
  },
  {
    ref: 'QA-10428',
    name: 'I. Novak',
    status: 'pending_allocation',
    start: '19:00',
    end: '20:45',
    party: 5,
    tables: [],
    notes: 'Prefers the garden room',
  },
  {
    ref: 'QA-10429',
    name: 'B. Ellis',
    status: 'confirmed',
    start: '19:00',
    end: '20:30',
    party: 2,
    tables: [['9', 'Garden room']],
  },
  {
    ref: 'QA-10430',
    name: 'O. Oyelaran',
    status: 'confirmed',
    start: '19:15',
    end: '21:00',
    party: 7,
    tables: [
      ['10', 'Garden room'],
      ['11', 'Garden room'],
    ],
    allergies: ['Milk'],
    diet: ['Vegetarian'],
    notes: 'Pram. Leave space beside the table.',
  },
  {
    ref: 'QA-10431',
    name: 'Priya Sharma',
    status: 'pending',
    start: '19:30',
    end: '21:15',
    party: 4,
    tables: [['12', 'Garden room']],
    notes: 'Window seat please',
    phone: '07700 900120',
  },
  {
    ref: 'QA-10432',
    name: 'V. Petrov',
    status: 'confirmed',
    start: '19:45',
    end: '21:30',
    party: 2,
    tables: [['2', 'Restaurant']],
  },
  {
    ref: 'QA-10433',
    name: 'Z. Ahmed',
    status: 'PRIORITY_WAITLIST',
    start: '20:00',
    end: '21:30',
    party: 3,
    tables: [],
  },
  {
    ref: 'QA-10434',
    name: 'W. Gallagher',
    status: 'confirmed',
    start: '20:15',
    end: '21:45',
    party: 2,
    tables: [['3', 'Restaurant']],
  },
  {
    ref: 'QA-10435',
    name: 'U. Lee',
    status: 'confirmed',
    start: '20:30',
    end: '22:00',
    party: 4,
    tables: [['5', 'Restaurant']],
    allergies: ['Gluten'],
  },
];

function toSummaryBooking(booking: FixtureBooking, index: number) {
  return {
    id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
    customerId: null,
    status: booking.status,
    bookingType: Number(booking.start.slice(0, 2)) < 16 ? 'lunch' : 'dinner',
    startTime: `${booking.start}:00`,
    endTime: `${booking.end}:00`,
    partySize: booking.party,
    customerName: booking.name,
    customerEmail: null,
    customerPhone: booking.phone ?? null,
    notes: booking.notes ?? null,
    reference: booking.ref,
    details: null,
    source: 'api',
    allergies: booking.allergies ?? null,
    dietaryRestrictions: booking.diet ?? null,
    tableAssignments: booking.tables.map(([tableNumber, section], tableIndex) => ({
      groupId: null,
      capacitySum: 4,
      members: [
        {
          tableId: `44444444-4444-4444-8444-${String(index * 10 + tableIndex).padStart(12, '0')}`,
          tableNumber,
          capacity: 4,
          section,
        },
      ],
    })),
    requiresTableAssignment: booking.tables.length === 0,
    checkedInAt: null,
    checkedOutAt: null,
  };
}

function buildPrintSummary(date: string) {
  const bookings = date === printDate ? DAY.map(toSummaryBooking) : [];
  return {
    meta: { date, timezone: 'Europe/London', restaurantId },
    date,
    timezone: 'Europe/London',
    restaurantId,
    totals: {
      total: bookings.length,
      confirmed: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 0,
      covers: bookings.reduce((sum, booking) => sum + booking.partySize, 0),
    },
    bookings,
  };
}

async function installOpsApiMocks(page: Page) {
  await page.route('**/api/ops/**', async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === '/api/ops/dashboard/summary') {
      const date = url.searchParams.get('date') ?? printDate;
      await route.fulfill({ json: buildPrintSummary(date) });
      return;
    }

    if (pathname === '/api/ops/restaurants') {
      await route.fulfill({
        json: {
          items: [restaurant],
          pageInfo: { page: 1, pageSize: 50, total: 1, hasNext: false },
        },
      });
      return;
    }

    if (pathname === `/api/ops/restaurants/${restaurantId}`) {
      await route.fulfill({ json: { restaurant } });
      return;
    }

    await route.fulfill({ json: {} });
  });
}

async function stubWindowPrint(page: Page) {
  await page.addInitScript(() => {
    const printWindow = window as Window & { __qaPrintCalls?: number };
    printWindow.__qaPrintCalls = 0;
    printWindow.print = () => {
      printWindow.__qaPrintCalls = (printWindow.__qaPrintCalls ?? 0) + 1;
    };
  });
}

const printCalls = (page: Page) =>
  page.evaluate(() => (window as Window & { __qaPrintCalls?: number }).__qaPrintCalls ?? 0);

test.describe('ops dashboard print unauthenticated contract', () => {
  test.use({ baseURL: appHostBaseUrl });

  test('print route redirects unauthenticated users to ops sign-in without leaking print content @p0 @browser @security @local-only', async ({
    page,
  }) => {
    await page.goto(`/dashboard/print?date=${printDate}&sortKey=party&sortDir=desc`, {
      waitUntil: 'domcontentloaded',
    });

    await page.waitForURL(/\/auth\/signin/, {
      timeout: 20_000,
      waitUntil: 'domcontentloaded',
    });
    const url = new URL(page.url());

    expect(url.hostname).toBe('app.localhost');
    expect(url.pathname).toBe('/auth/signin');
    expect(url.searchParams.get('redirectedFrom')).toBe(
      `/dashboard/print?date=${printDate}&sortKey=party&sortDir=desc`,
    );
    await expect(
      page.getByRole('heading', { name: 'Streamline your restaurant operations' }),
    ).toBeVisible();

    // The auth wall must not leak any print-view content to unauthenticated visitors.
    await expect(page.locator('#ops-print-root')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Bookings run sheet' })).toHaveCount(0);
  });

  test('print route responds 307 with a redirect-only body for unauthenticated requests @p0 @browser @security @local-only', async ({
    page,
  }) => {
    const response = await page.request.get('/dashboard/print', { maxRedirects: 0 });

    expect(response.status()).toBe(307);

    const location = response.headers()['location'];
    expect(location).toBeTruthy();
    const locationUrl = new URL(location, appHostBaseUrl);
    expect(locationUrl.pathname).toBe('/auth/signin');
    expect(locationUrl.searchParams.get('redirectedFrom')).toBe('/dashboard/print');

    // Next dev echoes the redirect target as the 307 body; nothing else (no ops
    // booking data) may ride along on the redirect response.
    const body = (await response.text()).trim();
    expect(body).toBe(`${locationUrl.pathname}${locationUrl.search}`);
  });
});

test.describe('ops dashboard run sheet', () => {
  test.use({ baseURL: appHostBaseUrl, viewport: { width: 1440, height: 1000 } });

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: qaAuthCookieName,
        value: qaAuthCookieValue,
        domain: 'app.localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    await stubWindowPrint(page);
    await installOpsApiMocks(page);
  });

  test('run sheet previews paginated A4 pages and prints only on request @p1 @browser @smoke @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto(`/dashboard/print?date=${printDate}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Bookings run sheet' })).toBeVisible();
    await expect(page).toHaveTitle(/^Run sheet · Saturday 16 May 2026/);

    const printRoot = page.locator('#ops-print-root');
    const firstPage = printRoot.getByRole('article').first();
    await expect(firstPage.getByText('QA App Host Restaurant')).toBeVisible();
    await expect(
      firstPage.getByRole('heading', { name: /Bookings · Saturday 16 May 2026/ }),
    ).toBeVisible();
    await expect(firstPage.getByText('Filter All · Sorted by time, earliest first')).toBeVisible();

    // 25 bookings do not fit on one portrait page; the table flows onto continuation pages.
    const pageLabel = await firstPage.getAttribute('aria-label');
    const pageCount = Number(/of (\d+)$/.exec(pageLabel ?? '')?.[1]);
    expect(pageCount).toBeGreaterThan(1);
    await expect(printRoot.getByRole('article')).toHaveCount(pageCount);
    await expect(printRoot.getByText('(continued)').first()).toBeVisible();
    await expect(printRoot.locator('tbody tr:has(td)')).toHaveCount(25);

    // Group headings carry spans and active covers.
    await expect(printRoot.getByText('12:00–15:30 · 9 bookings · 29 covers')).toBeVisible();
    await expect(printRoot.getByRole('cell', { name: 'Walk-in guest' })).toBeVisible();
    await expect(printRoot.getByText('Awaiting table')).toBeVisible();
    await expect(printRoot.getByText('Allergy: Peanuts')).toBeVisible();
    // The phone column is off by default.
    await expect(printRoot.getByText('07700 900120')).toHaveCount(0);

    // Nothing prints until the host asks.
    expect(await printCalls(page)).toBe(0);
    await page.getByRole('button', { name: `Print ${pageCount} pages` }).first().click();
    expect(await printCalls(page)).toBe(1);

    await page.screenshot({
      path: testInfo.outputPath('run-sheet-desktop.png'),
      fullPage: true,
    });

    // Print media keeps only the sheet: the app shell adds no pages.
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pdfPages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pdfPages).toHaveLength(pageCount);
    await testInfo.attach('run-sheet.pdf', { body: pdf, contentType: 'application/pdf' });
  });

  test('sheet options, filters and search reshape the sheet and keep criteria in the URL @p1 @browser @local-only', async ({
    page,
  }, testInfo) => {
    await page.goto(`/dashboard/print?date=${printDate}`, { waitUntil: 'domcontentloaded' });
    const printRoot = page.locator('#ops-print-root');
    await expect(page.getByText(/Data as of/).first()).toBeVisible();

    const options = page.getByRole('complementary', { name: 'Sheet options' });
    await options.getByLabel('Guest phone number').click();
    await expect(printRoot.getByText('07700 900120')).toBeVisible();

    await options.getByRole('radio', { name: /By status/ }).click();
    await expect(printRoot.locator('th[scope="colgroup"]').first()).toContainText('Seated');

    await options.getByRole('radio', { name: 'A4 landscape' }).click();
    await expect(
      printRoot.getByRole('columnheader', { name: 'Allergies and dietary' }).first(),
    ).toBeVisible();
    await expect(printRoot.getByRole('columnheader', { name: 'Notes' }).first()).toBeVisible();

    await page.getByRole('radio', { name: 'Bookings that need an action now' }).click();
    await expect(page).toHaveURL(/filter=attention/);

    await page.getByRole('radio', { name: /All bookings/ }).click();
    await page.getByRole('searchbox', { name: /Search by guest name/ }).fill('sharma');
    await expect(page).toHaveURL(/search=sharma/);
    await expect(printRoot.getByRole('article')).toHaveCount(1);
    await expect(printRoot.getByText('Search “sharma”')).toBeVisible();

    await page.getByRole('searchbox', { name: /Search by guest name/ }).fill('nobody');
    await expect(
      printRoot.getByRole('heading', { name: 'No bookings match these filters' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print sheet' }).first()).toBeDisabled();
    await page.getByRole('button', { name: 'Show all bookings' }).click();
    await expect(page).not.toHaveURL(/search=/);

    await page.screenshot({ path: testInfo.outputPath('run-sheet-landscape.png'), fullPage: true });

    // Options persist on this device.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(printRoot.getByRole('columnheader', { name: 'Notes' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Next day' }).click();
    await expect(page).toHaveURL(/date=2026-05-17/);
    await expect(
      printRoot.getByRole('heading', { name: /No bookings on Sunday 17 May 2026/ }),
    ).toBeVisible();
  });

  test('phones get a booking list and inline sheet actions @p1 @browser @local-only', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/print?date=${printDate}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^Print \d+ pages?$/ }).last()).toBeEnabled();

    await page.getByRole('radio', { name: 'Booking list' }).click();
    await expect(page.getByRole('region', { name: 'Dinner' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Dinner' }).getByText('Prefers the garden room'),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.screenshot({ path: testInfo.outputPath('run-sheet-phone.png') });

    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('dialog', { name: 'Sheet options' })).toBeVisible();
    await page.keyboard.press('Escape');

  });
});
