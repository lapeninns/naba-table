import { expect, test } from '@playwright/test';
import { source as axeSource } from 'axe-core';

import type { Page } from '@playwright/test';

const appPort = process.env.QA_APP_PORT ?? '5180';
const rootBaseUrl = `http://localhost:${appPort}`;
const appHostBaseUrl = `http://app.localhost:${appPort}`;
const publicBookingRestaurantSlug = 'qa-public-booking';
const publicBookingRestaurantId = '11111111-1111-4111-8111-111111111111';
const publicBookingTime = '12:30';
const publicBookingTimeLabel = '12:30 PM';

type VisualRoute = {
  name: string;
  setup?: (page: Page) => Promise<void>;
  url: string;
  verify?: (page: Page) => Promise<void>;
};

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

const publicBookingDate = formatDateKey(addDays(new Date(), 1));

async function installPublicBookingVisualMocks(page: Page) {
  await page.route('**/api/restaurants/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/calendar-mask')) {
      const from = url.searchParams.get('from') ?? publicBookingDate;
      const to = url.searchParams.get('to') ?? publicBookingDate;
      await route.fulfill({
        json: {
          timezone: 'Europe/London',
          from,
          to,
          closedDaysOfWeek: [],
          closedDates: [],
        },
      });
      return;
    }

    if (url.pathname.endsWith('/schedule')) {
      const date = url.searchParams.get('date') ?? publicBookingDate;
      await route.fulfill({
        json: {
          restaurantId: publicBookingRestaurantId,
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
              value: publicBookingTime,
              display: publicBookingTimeLabel,
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
        },
      });
      return;
    }

    await route.fulfill({
      json: {
        restaurant: {
          id: publicBookingRestaurantId,
          slug: publicBookingRestaurantSlug,
          name: 'The Fox',
          address: '1 High Street, London',
          phone: '+441234567890',
          email: 'hello@thefox.test',
          policy: 'You can cancel up to 24 hours before your reservation.',
          timezone: 'Europe/London',
          logoUrl: null,
          googleMapUrl: null,
        },
      },
    });
  });
}

const routes: VisualRoute[] = [
  { name: 'public-home', url: `${rootBaseUrl}/` },
  {
    name: 'public-booking',
    url: `${rootBaseUrl}/restaurants/${publicBookingRestaurantSlug}/book`,
    setup: installPublicBookingVisualMocks,
    verify: async (page) => {
      await expect(page.getByText('QA Public Booking Restaurant').first()).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Time' })).toBeVisible();
    },
  },
  { name: 'guest-sign-in', url: `${rootBaseUrl}/auth/signin?redirectedFrom=/guest/dashboard` },
  { name: 'onboarding-entry', url: `${rootBaseUrl}/onboarding` },
  { name: 'ops-sign-in', url: `${appHostBaseUrl}/auth/signin` },
];

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

async function assertNoCriticalAxeViolations(page: Page) {
  await page.addScriptTag({ content: axeSource });

  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe?: {
          run: (
            context: Document,
            options: {
              runOnly: { type: 'tag'; values: string[] };
            },
          ) => Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              nodes: Array<{ target: string[] }>;
            }>;
          }>;
        };
      }
    ).axe;

    if (!axe) {
      throw new Error('axe-core did not initialize');
    }

    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });

    return results.violations
      .filter((violation) => violation.impact === 'critical')
      .map((violation) => ({
        id: violation.id,
        targets: violation.nodes.flatMap((node) => node.target),
      }));
  });

  expect(violations).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

test.describe('UI visual route smoke', () => {
  for (const viewport of viewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of routes) {
        test(`${route.name} captures screenshot with critical axe and overflow checks @p2 @visual @a11y @browser @smoke`, async ({
          page,
        }, testInfo) => {
          await route.setup?.(page);
          await page.goto(route.url, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

          const bodyText = await page.locator('body').innerText();
          expect(bodyText.trim().length).toBeGreaterThan(0);

          await route.verify?.(page);
          await assertNoHorizontalOverflow(page);
          await assertNoCriticalAxeViolations(page);
          await page.screenshot({
            path: testInfo.outputPath(`${route.name}-${viewport.name}.png`),
            fullPage: true,
          });
        });
      }
    });
  }
});
