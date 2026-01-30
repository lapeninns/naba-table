import type { Page } from '@playwright/test';

const BOOKING_LINK_SELECTOR = 'a[href^="/guest/bookings/"]';

function extractBookingId(href: string | null): string | null {
  if (!href) return null;
  const match = href.match(/\/guest\/bookings\/([^/?#]+)/);
  return match?.[1] ?? null;
}

async function findBookingLink(page: Page): Promise<string | null> {
  const link = page.locator(BOOKING_LINK_SELECTOR).first();
  if (await link.isVisible({ timeout: 3_000 }).catch(() => false)) {
    return link.getAttribute('href');
  }

  const pastTab = page.getByRole('tab', { name: /past/i });
  if (await pastTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await pastTab.click();
    await page.waitForTimeout(1_000);
  }

  const fallbackLink = page.locator(BOOKING_LINK_SELECTOR).first();
  if (await fallbackLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
    return fallbackLink.getAttribute('href');
  }

  return null;
}

export async function resolveGuestBookingId(page: Page, baseUrl: string): Promise<string> {
  await page.goto(`${baseUrl}/guest/bookings`);
  await page.waitForLoadState('networkidle');

  const emptyState = page.getByText(/no bookings yet/i);
  if (await emptyState.isVisible({ timeout: 2_000 }).catch(() => false)) {
    throw new Error('No bookings found for guest. Seed a booking or run booking CRUD before route coverage.');
  }

  const href = await findBookingLink(page);
  const bookingId = extractBookingId(href);

  if (!bookingId) {
    throw new Error('Unable to resolve booking id from guest bookings list.');
  }

  return bookingId;
}
