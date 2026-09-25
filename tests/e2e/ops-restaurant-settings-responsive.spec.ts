import { expect, test } from '@playwright/test';

import {
  appHostBaseUrl,
  installCommandCenterApiMocks,
  qaAuthCookieName,
  qaAuthCookieValue,
} from './helpers/restaurant-settings-api-mocks';

import type { Page } from '@playwright/test';

/**
 * Responsive sweep for every route under /settings/restaurant/*. Each route is loaded once and
 * then resized through phone, tablet, laptop, and desktop widths (including awkward intermediate
 * widths) so layout breaks between the usual breakpoints are caught, not just at presets.
 *
 * `email-templates` is excluded: it redirects to the standalone email templates workspace, which
 * is outside the settings shell (covered by ops-settings-team.spec.ts).
 */
const SETTINGS_ROUTES = [
  '/settings/restaurant',
  '/settings/restaurant/profile',
  '/settings/restaurant/discovery',
  '/settings/restaurant/google-business-profile',
  '/settings/restaurant/availability',
  '/settings/restaurant/operating-hours',
  '/settings/restaurant/service-periods',
  '/settings/restaurant/turn-durations',
  '/settings/restaurant/occasions',
  '/settings/restaurant/menu',
  '/settings/restaurant/tables',
  '/settings/restaurant/team',
] as const;

const VIEWPORT_WIDTHS = [
  320, 360, 375, 390, 414, 430, 600, 768, 820, 1024, 1180, 1280, 1366, 1440, 1920,
];
const SCREENSHOT_WIDTHS = new Set([390, 768, 1024, 1440]);

type OverflowReport = {
  documentOverflow: number;
  contentOverflow: number;
  offenders: string[];
};

async function measureHorizontalOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders: string[] = [];

    // The settings shell scrolls vertically inside #ops-content; a vertical scroller also clips
    // horizontally, so it must not count as an intentional horizontal container.
    const pageScroller = document.getElementById('ops-content');
    // Where an offender lives: the closest ancestor with an id, data-slot or accessible name.
    const nearestNamed = (element: Element) => {
      const named = element.parentElement?.closest('[id],[data-slot],[aria-label]');
      if (!named) return '';
      const name =
        named.id || named.getAttribute('data-slot') || named.getAttribute('aria-label') || '';
      return ` near ${named.tagName.toLowerCase()}(${name})`;
    };
    const clipsOrScrollsX = (element: Element) => {
      if (element === pageScroller) return false;
      const overflowX = getComputedStyle(element).overflowX;
      return overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden';
    };

    for (const element of Array.from(document.querySelectorAll('body *'))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Measure icons as a whole. An <svg> clips its own shapes (UA `overflow: hidden`), which
      // would otherwise be mistaken for the scroll region that contains the icon.
      if (element instanceof SVGElement && !(element instanceof SVGSVGElement)) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      // Off-canvas navigation and toasts are positioned outside the flow on purpose.
      if (style.position === 'fixed') continue;
      if (rect.right <= viewportWidth + 1 && rect.left >= -1) continue;

      // Content inside its own scroll/clip region (tables, tab rails, truncation) is contained.
      let ancestor = element.parentElement;
      let contained = false;
      while (ancestor && ancestor !== document.body) {
        if (clipsOrScrollsX(ancestor)) {
          const box = ancestor.getBoundingClientRect();
          contained = box.right <= viewportWidth + 1 && box.left >= -1;
          break;
        }
        if (getComputedStyle(ancestor).position === 'fixed') {
          contained = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (contained) continue;

      // Icons have no useful text; name them by their class instead.
      const iconClass =
        element instanceof SVGSVGElement
          ? `.${(element.getAttribute('class') ?? '').trim().replace(/\s+/g, '.')}`
          : '';
      const label = [
        element.tagName.toLowerCase(),
        iconClass,
        element.id ? `#${element.id}` : '',
        element.getAttribute('data-slot') ? `[data-slot=${element.getAttribute('data-slot')}]` : '',
        ` "${(element.textContent ?? '').trim().slice(0, 40)}"`,
        nearestNamed(element),
        ` right=${Math.round(rect.right)}`,
      ].join('');
      offenders.push(label);
      if (offenders.length >= 8) break;
    }

    return {
      documentOverflow: document.documentElement.scrollWidth - viewportWidth,
      contentOverflow: pageScroller ? pageScroller.scrollWidth - pageScroller.clientWidth : 0,
      offenders,
    };
  });
}

type ChromeReport = {
  chromeHeight: number;
  titleVisible: boolean;
  closeInView: boolean;
  overlapsContent: boolean;
};

/** The shared settings chrome must stay compact, keep its title and exit, and never cover content. */
async function measureSettingsChrome(page: Page): Promise<ChromeReport | null> {
  return page.evaluate(() => {
    const chrome = document.querySelector('[data-slot="settings-chrome"]');
    const content = document.getElementById('ops-content');
    if (!chrome || !content) return null;
    const viewportWidth = document.documentElement.clientWidth;
    const chromeBox = chrome.getBoundingClientRect();
    const title = chrome.querySelector('h1')?.getBoundingClientRect();
    const close = chrome
      .querySelector('a[aria-label="Close restaurant settings"]')
      ?.getBoundingClientRect();
    return {
      chromeHeight: Math.round(chromeBox.height),
      titleVisible: Boolean(title && title.width > 24 && title.height > 0),
      closeInView: Boolean(close && close.width > 0 && close.right <= viewportWidth + 1),
      overlapsContent: content.getBoundingClientRect().top < chromeBox.bottom - 1,
    };
  });
}

/** One row (48px) plus room for a two-line title on phones; anything taller is a regression. */
const MAX_CHROME_HEIGHT = 64;

test.describe('ops restaurant settings responsive sweep', () => {
  test.use({ baseURL: appHostBaseUrl, viewport: { width: 1280, height: 900 } });

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
    await installCommandCenterApiMocks(page);
  });

  for (const route of SETTINGS_ROUTES) {
    test(`${route} has no horizontal overflow from 320px to 1920px @p1 @browser @local-only`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      // A route that crashed into the settings error boundary has nothing left to overflow, so
      // it would pass the sweep vacuously. Fail on render errors instead.
      const renderErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('render error')) {
          renderErrors.push(message.text().slice(0, 200));
        }
      });
      page.on('pageerror', (error) => renderErrors.push(error.message.slice(0, 200)));
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
      await expect(page.locator('h1').first()).toBeVisible();

      const failures: string[] = [];
      for (const width of VIEWPORT_WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        // Let container queries, sidebar collapse, and sticky bars settle.
        await page.waitForTimeout(150);
        const report = await measureHorizontalOverflow(page);
        if (
          report.documentOverflow > 1 ||
          report.contentOverflow > 1 ||
          report.offenders.length > 0
        ) {
          failures.push(
            `${width}px: page overflow ${report.documentOverflow}px, content overflow ${report.contentOverflow}px; ${report.offenders.join(' | ')}`,
          );
        }
        const chrome = await measureSettingsChrome(page);
        if (!chrome) {
          failures.push(`${width}px: settings chrome or #ops-content missing`);
        } else if (
          chrome.chromeHeight > MAX_CHROME_HEIGHT ||
          !chrome.titleVisible ||
          !chrome.closeInView ||
          chrome.overlapsContent
        ) {
          failures.push(`${width}px: chrome ${JSON.stringify(chrome)}`);
        }
        if (SCREENSHOT_WIDTHS.has(width)) {
          const slug = route.replace(/\//g, '-').replace(/^-/, '') || 'root';
          await page.screenshot({
            path: testInfo.outputPath(`${slug}-${width}.png`),
            fullPage: true,
          });
        }
      }

      expect(renderErrors, renderErrors.join('\n')).toEqual([]);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});
