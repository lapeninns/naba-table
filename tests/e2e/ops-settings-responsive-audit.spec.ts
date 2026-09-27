import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

import {
  appHostBaseUrl,
  installCommandCenterApiMocks,
  qaAuthCookieName,
  qaAuthCookieValue,
} from './helpers/restaurant-settings-api-mocks';

import type { BrowserContextOptions, Page } from '@playwright/test';

/**
 * Opt-in responsive audit for every restaurant settings page (QA_RESPONSIVE_AUDIT=1). It never
 * fails on findings: it writes `<slug>.audit.json` and screenshots per page so fixes can be
 * planned from evidence. The pass/fail gate stays in ops-restaurant-settings-responsive.spec.ts.
 */
test.skip(process.env.QA_RESPONSIVE_AUDIT !== '1', 'Set QA_RESPONSIVE_AUDIT=1 to run the audit');

type Trigger = { role: 'button' | 'combobox' | 'link'; name: RegExp };

/** `prepare` runs before the overlay triggers (e.g. open a template so its pane shows on phones). */
const PAGES: Array<{ path: string; triggers: Trigger[]; prepare?: Trigger }> = [
  // The overview's 'Preview guest times' is a link to Availability, not an overlay.
  { path: '/settings/restaurant', triggers: [] },
  { path: '/settings/restaurant/profile', triggers: [] },
  {
    path: '/settings/restaurant/discovery',
    triggers: [{ role: 'button', name: /Opening date|Pick a date/ }],
  },
  { path: '/settings/restaurant/google-business-profile', triggers: [] },
  {
    path: '/settings/restaurant/availability',
    triggers: [
      { role: 'button', name: /^Add special date$/ },
      { role: 'button', name: /^Preview guest times$/ },
    ],
  },
  { path: '/settings/restaurant/menu', triggers: [{ role: 'button', name: /^Create menu$/ }] },
  {
    path: '/settings/restaurant/tables',
    // 'Add zone' first: an unsaved new table asks before closing, which would block the next trigger.
    triggers: [
      { role: 'button', name: /^Add zone$/ },
      { role: 'button', name: /^Add table$/ },
    ],
  },
  { path: '/settings/restaurant/team', triggers: [{ role: 'combobox', name: /Role/ }] },
  { path: '/settings/restaurant/staff-communications', triggers: [] },
  { path: '/settings/restaurant/floor-layout', triggers: [] },
  {
    path: '/settings/restaurant/email-templates',
    prepare: { role: 'button', name: /^Request Received/ },
    triggers: [
      { role: 'button', name: /^Send test$/ },
      { role: 'button', name: /^More actions|^Template actions|^\.\.\.$/ },
    ],
  },
];

/** Portrait widths including in-between sizes, and landscape phone/tablet sizes. */
const VIEWPORTS: Array<{ width: number; height: number; label: string; shot?: boolean }> = [
  { width: 320, height: 640, label: 'phone-320', shot: true },
  { width: 360, height: 780, label: 'phone-360' },
  { width: 390, height: 844, label: 'phone-390', shot: true },
  { width: 430, height: 932, label: 'phone-430' },
  { width: 520, height: 900, label: 'between-520' },
  { width: 667, height: 375, label: 'phone-landscape-667', shot: true },
  { width: 844, height: 390, label: 'phone-landscape-844', shot: true },
  { width: 768, height: 1024, label: 'tablet-768', shot: true },
  { width: 900, height: 1000, label: 'between-900' },
  { width: 1024, height: 768, label: 'tablet-landscape-1024', shot: true },
  { width: 1180, height: 820, label: 'tablet-landscape-1180' },
  { width: 1280, height: 800, label: 'laptop-1280', shot: true },
  { width: 1366, height: 768, label: 'laptop-1366' },
  { width: 1920, height: 1080, label: 'desktop-1920', shot: true },
];

type LayoutFindings = {
  documentOverflow: number;
  contentOverflow: number;
  escaping: string[];
  clippedText: string[];
  truncatedText: string[];
  scrollStrips: string[];
  overlapping: string[];
  dockedBarsHeight: number;
};

/** Everything measured in the page, in one pass. */
async function measureLayout(page: Page): Promise<LayoutFindings> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const describe = (element: Element) => {
      const named = element.closest('[id],[data-slot],[aria-label]');
      const where = named
        ? ` in ${named.tagName.toLowerCase()}(${named.id || named.getAttribute('data-slot') || named.getAttribute('aria-label')})`
        : '';
      return `${element.tagName.toLowerCase()} "${(element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50)}"${where}`;
    };
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        Number(style.opacity) > 0.05
      );
    };
    // Screen-reader-only text (sr-only: 1px box with clip) is hidden on purpose.
    const srOnly = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        (rect.width <= 1 && rect.height <= 1) ||
        style.clip === 'rect(0px, 0px, 0px, 0px)' ||
        style.clipPath === 'inset(50%)'
      );
    };
    const scrollsOrClipsX = (element: Element) => {
      const x = getComputedStyle(element).overflowX;
      return x === 'auto' || x === 'scroll' || x === 'hidden' || x === 'clip';
    };

    const escaping: string[] = [];
    const clippedText: string[] = [];
    const truncatedText: string[] = [];
    const scrollStrips: string[] = [];

    for (const element of Array.from(document.querySelectorAll('body *'))) {
      if (!visible(element) || srOnly(element)) continue;
      if (element instanceof SVGElement) continue;
      const style = getComputedStyle(element);
      if (style.position === 'fixed') continue;
      const rect = element.getBoundingClientRect();

      // Escaping the viewport without a clipping/scrolling ancestor inside the viewport.
      if (rect.right > vw + 1 || rect.left < -1) {
        let ancestor = element.parentElement;
        let contained = false;
        while (ancestor && ancestor !== document.body) {
          if (getComputedStyle(ancestor).position === 'fixed') {
            contained = true;
            break;
          }
          if (scrollsOrClipsX(ancestor)) {
            const box = ancestor.getBoundingClientRect();
            contained = box.right <= vw + 1 && box.left >= -1;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        if (!contained && escaping.length < 10)
          escaping.push(`${describe(element)} right=${Math.round(rect.right)}`);
      }

      const hasOwnText = Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0,
      );
      // Text cut off by its own box.
      if (hasOwnText && element.scrollWidth > element.clientWidth + 1 && scrollsOrClipsX(element)) {
        const target = style.textOverflow === 'ellipsis' ? truncatedText : clippedText;
        if (target.length < 15)
          target.push(`${describe(element)} ${element.scrollWidth}>${element.clientWidth}`);
      }

      // Horizontal scroll strips that hide content (tabs, segmented controls, tables).
      const x = style.overflowX;
      if ((x === 'auto' || x === 'scroll') && element.scrollWidth > element.clientWidth + 1) {
        if (scrollStrips.length < 10) {
          scrollStrips.push(
            `${describe(element)} hides ${element.scrollWidth - element.clientWidth}px`,
          );
        }
      }
    }

    // Interactive controls covering each other (e.g. a floating button over a field).
    const overlapping: string[] = [];
    const controls = Array.from(
      document.querySelectorAll(
        'button, a[href], input, textarea, [role="combobox"], [role="switch"], [role="tab"], [role="radio"]',
      ),
    ).filter(visible);
    const boxes = controls.map((element) => ({ element, rect: element.getBoundingClientRect() }));
    for (let i = 0; i < boxes.length && overlapping.length < 8; i += 1) {
      for (let j = i + 1; j < boxes.length && overlapping.length < 8; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        const w = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const h = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (w > 4 && h > 4) {
          overlapping.push(
            `${describe(a.element)} × ${describe(b.element)} (${Math.round(w)}×${Math.round(h)})`,
          );
        }
      }
    }

    // Docked/sticky bars at the bottom eat the viewport in landscape.
    let dockedBarsHeight = 0;
    for (const element of Array.from(
      document.querySelectorAll(
        '[data-slot="settings-save-bar"], [data-slot="settings-section-nav"]',
      ),
    )) {
      if (visible(element)) dockedBarsHeight += element.getBoundingClientRect().height;
    }
    const scroller = document.getElementById('ops-content');
    return {
      documentOverflow: document.documentElement.scrollWidth - vw,
      contentOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
      escaping,
      clippedText,
      truncatedText,
      scrollStrips,
      overlapping,
      dockedBarsHeight: Math.round((dockedBarsHeight / vh) * 100),
    };
  });
}

/** Controls smaller than 44×44 on a touch phone (inline prose links excepted). */
async function measureTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = [];
    const targets = document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="combobox"], [role="switch"], [role="tab"], [role="radio"], [role="checkbox"], [role="menuitem"], [role="option"]',
    );
    for (const element of Array.from(targets)) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue;
      // Screen-reader-only and Radix's hidden native <select> mirror are not touch targets.
      if (rect.width <= 1 || rect.height <= 1 || element.getAttribute('aria-hidden') === 'true')
        continue;
      if (
        element.tagName === 'A' &&
        element.getAttribute('href') === '#main-content' &&
        rect.width < 2
      )
        continue;
      // Links inside running text follow WCAG's inline exception.
      if (element.tagName === 'A' && element.closest('p, li, span') && style.display === 'inline')
        continue;
      // A control whose label wraps it counts the label's box.
      const label = element.closest('label');
      const box = label ? label.getBoundingClientRect() : rect;
      // Switch/Checkbox draw a 44px hit area with ::after on coarse pointers.
      const after = getComputedStyle(element, '::after');
      if (
        after.content !== 'none' &&
        parseFloat(after.width) >= 43.5 &&
        parseFloat(after.height) >= 43.5
      ) {
        continue;
      }
      if (box.height < 43.5 || box.width < 43.5) {
        const name =
          element.getAttribute('aria-label') ??
          (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40) ??
          element.tagName;
        small.push(
          `${element.tagName.toLowerCase()}${element.getAttribute('role') ? `[${element.getAttribute('role')}]` : ''} "${name}" ${Math.round(box.width)}×${Math.round(box.height)}`,
        );
        if (small.length >= 25) break;
      }
    }
    return small;
  });
}

type OverlayFindings = { trigger: string; viewport: string; found: boolean; issues: string[] };

/** Open a dialog/sheet/menu and check it fits and its actions are reachable. */
async function auditOverlay(
  page: Page,
  trigger: Trigger,
  viewport: string,
  shot: string,
): Promise<OverlayFindings> {
  const control = page.getByRole(trigger.role, { name: trigger.name }).first();
  if ((await control.count()) === 0 || !(await control.isVisible().catch(() => false))) {
    return { trigger: String(trigger.name), viewport, found: false, issues: [] };
  }
  const opened = await control
    .click({ timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    await page.screenshot({ path: shot.replace('.png', '-click-failed.png'), fullPage: false });
    return {
      trigger: String(trigger.name),
      viewport,
      found: true,
      issues: ['trigger could not be clicked (covered or detached)'],
    };
  }
  // Let enter animations (sheet slide-in, dialog zoom) finish before measuring.
  await page.waitForTimeout(900);
  const issues = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const overlay = document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]',
    );
    if (!overlay) return ['no dialog/sheet/listbox/menu opened'];
    const out: string[] = [];
    const rect = overlay.getBoundingClientRect();
    if (rect.left < -1 || rect.right > vw + 1)
      out.push(
        `overlay spills horizontally ${Math.round(rect.left)}..${Math.round(rect.right)} of ${vw}`,
      );
    if (rect.top < -1) out.push(`overlay top ${Math.round(rect.top)} is above the viewport`);
    if (rect.bottom > vh + 1 && getComputedStyle(overlay).overflowY === 'visible') {
      out.push(
        `overlay bottom ${Math.round(rect.bottom)} below viewport ${vh} and does not scroll`,
      );
    }
    if (overlay.scrollWidth > overlay.clientWidth + 1)
      out.push(
        `overlay content overflows sideways by ${overlay.scrollWidth - overlay.clientWidth}px`,
      );
    // Primary actions must be reachable: inside the viewport, or inside a scroll region.
    for (const button of Array.from(overlay.querySelectorAll('button'))) {
      const box = button.getBoundingClientRect();
      if (box.width === 0) continue;
      if (box.right > vw + 1 || box.left < -1)
        out.push(`button "${button.textContent?.trim().slice(0, 30)}" is off-screen sideways`);
    }
    return out;
  });
  await page.screenshot({ path: shot, fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  // Some sheets need a second Escape (nested popovers); make sure nothing modal is left open.
  if ((await page.locator('[role="dialog"], [role="alertdialog"]').count()) > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  return { trigger: String(trigger.name), viewport, found: true, issues };
}

async function openPrepare(page: Page, prepare: Trigger) {
  await page
    .getByRole(prepare.role, { name: prepare.name })
    .first()
    .click({ timeout: 5_000 })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

const touchPhone: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};

test.describe('settings responsive audit (report only)', () => {
  test.use({ baseURL: appHostBaseUrl });

  for (const { path, triggers, prepare } of PAGES) {
    const slug = path.replace(/\//g, '-').replace(/^-/, '');

    test(`audit ${path}`, async ({ browser }, testInfo) => {
      test.setTimeout(240_000);
      const report: Record<string, unknown> = {
        path,
        layout: {},
        touch: [],
        overlays: [],
        renderErrors: [],
      };
      const renderErrors: string[] = [];

      const open = async (options: BrowserContextOptions) => {
        const context = await browser.newContext({ ...options, baseURL: appHostBaseUrl });
        await context.addCookies([
          {
            name: qaAuthCookieName,
            value: qaAuthCookieValue,
            domain: 'app.localhost',
            path: '/',
            sameSite: 'Lax',
          },
        ]);
        const page = await context.newPage();
        page.on('pageerror', (error) => renderErrors.push(error.message.slice(0, 200)));
        page.on('console', (message) => {
          if (message.type() === 'error' && message.text().includes('render error'))
            renderErrors.push(message.text().slice(0, 200));
        });
        await installCommandCenterApiMocks(page);
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
        await expect(page.locator('h1').first()).toBeVisible();
        return { context, page };
      };

      // Layout sweep (desktop pointer).
      const desk = await open({ viewport: { width: 1280, height: 800 } });
      for (const viewport of VIEWPORTS) {
        await desk.page.setViewportSize({ width: viewport.width, height: viewport.height });
        await desk.page.waitForTimeout(200);
        (report.layout as Record<string, LayoutFindings>)[viewport.label] = await measureLayout(
          desk.page,
        );
        if (viewport.shot) {
          await desk.page.screenshot({
            path: testInfo.outputPath(`${slug}--${viewport.label}.png`),
            fullPage: viewport.height >= 640,
          });
        }
      }
      await desk.page.setViewportSize({ width: 1440, height: 900 });
      if (prepare) await openPrepare(desk.page, prepare);
      for (const trigger of triggers) {
        (report.overlays as OverlayFindings[]).push(
          await auditOverlay(
            desk.page,
            trigger,
            'desktop-1440',
            testInfo.outputPath(`${slug}--overlay-${triggers.indexOf(trigger)}-1440.png`),
          ),
        );
      }
      await desk.context.close();

      // Touch phone: coarse pointer, touch targets, overlays.
      const phone = await open(touchPhone);
      report.touch = await measureTouchTargets(phone.page);
      (report.layout as Record<string, LayoutFindings>)['touch-phone-390'] = await measureLayout(
        phone.page,
      );
      await phone.page.screenshot({
        path: testInfo.outputPath(`${slug}--touch-390.png`),
        fullPage: true,
      });
      if (prepare) await openPrepare(phone.page, prepare);
      for (const trigger of triggers) {
        (report.overlays as OverlayFindings[]).push(
          await auditOverlay(
            phone.page,
            trigger,
            'touch-390',
            testInfo.outputPath(`${slug}--overlay-${triggers.indexOf(trigger)}-390.png`),
          ),
        );
      }
      await phone.context.close();

      report.renderErrors = renderErrors;
      writeFileSync(testInfo.outputPath(`${slug}.audit.json`), JSON.stringify(report, null, 1));
    });
  }
});
