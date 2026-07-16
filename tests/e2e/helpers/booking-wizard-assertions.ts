import { expect, type Locator, type Page } from '@playwright/test';
import { source as axeSource } from 'axe-core';

type RgbaColor = {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
};

export type ComputedColorLayer = {
  readonly node: string;
  readonly background: string;
  readonly opacity: number;
};

export type ContrastEvidence = {
  readonly computedForeground: string;
  readonly computedLayers: readonly ComputedColorLayer[];
  readonly effectiveForeground: RgbaColor & { readonly css: string };
  readonly effectiveBackground: RgbaColor & { readonly css: string };
  readonly ratio: number;
  readonly threshold: number;
  readonly passed: boolean;
};

export type FocusedAxeEvidence = {
  readonly ruleId: 'color-contrast';
  readonly violations: readonly AxeFinding[];
  readonly incomplete: readonly AxeFinding[];
  readonly passes: readonly AxeFinding[];
  readonly passed: boolean;
};

export type ElementRailEvidence = {
  readonly label: string;
  readonly element: Readonly<{ top: number; right: number; bottom: number; left: number }>;
  readonly topBoundary: number;
  readonly railTop: number;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
  readonly overlap: number;
};

export type SettledAccessibilityEvidence = {
  readonly minAncestorOpacity: number;
  readonly activeAncestorAnimations: number;
  readonly ariaBusy: string | null;
  readonly hitTarget: string;
  readonly hitVisibleTarget: boolean;
  readonly passed: boolean;
};

type AxeFinding = {
  readonly id: string;
  readonly nodes: readonly {
    readonly failureSummary: string;
    readonly html: string;
    readonly target: unknown;
  }[];
};

class UnsupportedComputedColorError extends Error {
  readonly name = 'UnsupportedComputedColorError';

  constructor(readonly value: string) {
    super(`Unsupported computed color: ${value}`);
  }
}

function parseFinite(value: string, source: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) throw new UnsupportedComputedColorError(source);
  return parsed;
}

function parseChannel(value: string, source: string): number {
  const parsed = parseFinite(value, source);
  const channel = value.endsWith('%') ? (parsed / 100) * 255 : parsed;
  if (channel < 0 || channel > 255) throw new UnsupportedComputedColorError(source);
  return channel;
}

function parseAlpha(value: string | undefined, source: string): number {
  if (value === undefined) return 1;
  const parsed = parseFinite(value, source);
  const alpha = value.endsWith('%') ? parsed / 100 : parsed;
  if (alpha < 0 || alpha > 1) throw new UnsupportedComputedColorError(source);
  return alpha;
}

function parseSrgbChannel(value: string, source: string): number {
  const parsed = parseFinite(value, source);
  if (parsed < 0 || parsed > 1) throw new UnsupportedComputedColorError(source);
  return parsed * 255;
}

export function parseComputedColor(value: string): RgbaColor {
  const rgb = /^rgba?\((.+)\)$/i.exec(value);
  if (rgb) {
    const body = rgb[1];
    if (body === undefined) throw new UnsupportedComputedColorError(value);
    const slashParts = body.split('/');
    if (slashParts.length > 2) throw new UnsupportedComputedColorError(value);
    const channelPart = slashParts[0];
    if (channelPart === undefined) throw new UnsupportedComputedColorError(value);
    const commaParts = channelPart.split(',').map((part) => part.trim());
    const channels = commaParts.length > 1 ? commaParts : channelPart.trim().split(/\s+/);
    const inlineAlpha = commaParts.length === 4 ? commaParts[3] : undefined;
    const alphaPart = slashParts[1]?.trim() ?? inlineAlpha;
    if (channels.length !== 3 && channels.length !== 4) {
      throw new UnsupportedComputedColorError(value);
    }
    const red = channels[0];
    const green = channels[1];
    const blue = channels[2];
    if (red === undefined || green === undefined || blue === undefined) {
      throw new UnsupportedComputedColorError(value);
    }
    return {
      red: parseChannel(red, value),
      green: parseChannel(green, value),
      blue: parseChannel(blue, value),
      alpha: parseAlpha(alphaPart, value),
    };
  }

  const srgb = /^color\(srgb\s+([^\s/]+)\s+([^\s/]+)\s+([^\s/]+)(?:\s*\/\s*([^\s)]+))?\)$/i.exec(
    value,
  );
  if (srgb) {
    const red = srgb[1];
    const green = srgb[2];
    const blue = srgb[3];
    if (red === undefined || green === undefined || blue === undefined) {
      throw new UnsupportedComputedColorError(value);
    }
    return {
      red: parseSrgbChannel(red, value),
      green: parseSrgbChannel(green, value),
      blue: parseSrgbChannel(blue, value),
      alpha: parseAlpha(srgb[4], value),
    };
  }

  throw new UnsupportedComputedColorError(value);
}

function compositeOver(foreground: RgbaColor, background: RgbaColor): RgbaColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
  return {
    red:
      (foreground.red * foreground.alpha +
        background.red * background.alpha * (1 - foreground.alpha)) /
      alpha,
    green:
      (foreground.green * foreground.alpha +
        background.green * background.alpha * (1 - foreground.alpha)) /
      alpha,
    blue:
      (foreground.blue * foreground.alpha +
        background.blue * background.alpha * (1 - foreground.alpha)) /
      alpha,
    alpha,
  };
}

function renderPixel(seed: RgbaColor, layers: readonly ComputedColorLayer[]): RgbaColor {
  let pixel = seed;
  for (const layer of layers) {
    pixel = compositeOver(pixel, parseComputedColor(layer.background));
    pixel = { ...pixel, alpha: pixel.alpha * layer.opacity };
  }
  if (pixel.alpha < 0.9999) {
    throw new Error(`Unable to resolve opaque computed background; alpha=${pixel.alpha}`);
  }
  return { ...pixel, alpha: 1 };
}

function relativeLuminance(color: RgbaColor): number {
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(color.red) + 0.7152 * linear(color.green) + 0.0722 * linear(color.blue);
}

function withCss(color: RgbaColor): RgbaColor & { readonly css: string } {
  return {
    ...color,
    css: `rgb(${color.red.toFixed(3)} ${color.green.toFixed(3)} ${color.blue.toFixed(3)})`,
  };
}

export function computeContrastEvidence(
  computedForeground: string,
  computedLayers: readonly ComputedColorLayer[],
  threshold = 4.5,
): ContrastEvidence {
  const transparent = { red: 0, green: 0, blue: 0, alpha: 0 };
  const foreground = renderPixel(parseComputedColor(computedForeground), computedLayers);
  const background = renderPixel(transparent, computedLayers);
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  const ratio = (light + 0.05) / (dark + 0.05);
  return {
    computedForeground,
    computedLayers,
    effectiveForeground: withCss(foreground),
    effectiveBackground: withCss(background),
    ratio,
    threshold,
    passed: ratio >= threshold,
  };
}

export async function hideLocalDevIndicators(page: Page): Promise<void> {
  await page.addStyleTag({
    content: 'nextjs-portal, .tsqd-parent-container { display: none !important; }',
  });
}

export async function measureElementContrast(locator: Locator): Promise<ContrastEvidence> {
  const computed = await locator.evaluate((element) => {
    const layers: ComputedColorLayer[] = [];
    let current: Element | null = element;
    while (current) {
      const style = getComputedStyle(current);
      const opacity = Number.parseFloat(style.opacity);
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        throw new Error(`Invalid computed opacity: ${style.opacity}`);
      }
      layers.push({
        node: current.tagName.toLowerCase(),
        background: style.backgroundColor,
        opacity,
      });
      current = current.parentElement;
    }
    return { foreground: getComputedStyle(element).color, layers };
  });
  return computeContrastEvidence(computed.foreground, computed.layers);
}

export async function clickClientControl(locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'visible' });
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Expected an HTML control');
    element.click();
  });
}

export async function assertNoWizardOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

export async function assertMinimumTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(43.99);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.99);
}

export async function assertRailGeometry(page: Page, finalControl: Locator): Promise<void> {
  const rail = page.locator('[data-booking-wizard-navigation]');
  const measuredRail = page.locator('[data-wizard-navigation-rail]');
  const layout = page
    .locator('[data-booking-wizard-progress-slot]')
    .locator('xpath=ancestor::div[starts-with(normalize-space(@style),"padding-bottom")][1]');
  await expect(rail).toBeVisible();
  await expect(finalControl).toBeAttached();

  const railBox = await rail.boundingBox();
  const measuredRailBox = await measuredRail.boundingBox();
  const padding = await layout.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      bottom: Number.parseFloat(style.paddingBottom),
      scroll: Number.parseFloat(style.scrollPaddingBottom),
    };
  });

  expect(railBox).not.toBeNull();
  expect(measuredRailBox).not.toBeNull();
  expect(padding.bottom).toBeGreaterThanOrEqual(railBox?.height ?? Number.POSITIVE_INFINITY);
  expect(padding.scroll).toBeGreaterThanOrEqual(
    measuredRailBox?.height ?? Number.POSITIVE_INFINITY,
  );
}

export async function waitForSettledLocator(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  let previous = '';
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      const current = box
        ? [box.x, box.y, box.width, box.height].map((value) => value.toFixed(2)).join(':')
        : 'missing';
      const settled = current === previous;
      previous = current;
      return settled;
    })
    .toBe(true);
}

async function collectSettledAccessibilityEvidence(
  locator: Locator,
): Promise<SettledAccessibilityEvidence> {
  return locator.evaluate((element) => {
    const ancestors: Element[] = [];
    let current: Element | null = element;
    while (current) {
      ancestors.push(current);
      current = current.parentElement;
    }
    const minAncestorOpacity = ancestors.reduce((minimum, ancestor) => {
      const opacity = Number.parseFloat(getComputedStyle(ancestor).opacity);
      if (!Number.isFinite(opacity)) throw new Error(`Invalid computed opacity: ${opacity}`);
      return Math.min(minimum, opacity);
    }, 1);
    const activeAncestorAnimations = document.getAnimations().filter((animation) => {
      if (animation.playState !== 'running' && animation.playState !== 'pending') return false;
      const target =
        animation.effect instanceof KeyframeEffect && animation.effect.target instanceof Element
          ? animation.effect.target
          : null;
      return target !== null && (target === element || target.contains(element));
    }).length;
    const busyOwner = element.closest('[aria-busy]');
    const ariaBusy = busyOwner?.getAttribute('aria-busy') ?? null;
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    const hitVisibleTarget = hit !== null && (hit === element || element.contains(hit));
    const hitTarget = hit ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}` : 'none';
    return {
      minAncestorOpacity,
      activeAncestorAnimations,
      ariaBusy,
      hitTarget,
      hitVisibleTarget,
      passed:
        element.isConnected &&
        rect.width > 0 &&
        rect.height > 0 &&
        minAncestorOpacity >= 0.999 &&
        activeAncestorAnimations === 0 &&
        ariaBusy !== 'true' &&
        hitVisibleTarget,
    };
  });
}

export async function waitForSettledAccessibilityTarget(
  locator: Locator,
): Promise<SettledAccessibilityEvidence> {
  await waitForSettledLocator(locator);
  await expect
    .poll(async () => (await collectSettledAccessibilityEvidence(locator)).passed)
    .toBe(true);
  return collectSettledAccessibilityEvidence(locator);
}

export async function assertElementAboveRail(
  page: Page,
  locator: Locator,
  label: string,
  reposition = true,
  settle = true,
): Promise<ElementRailEvidence> {
  if (reposition) {
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate((element) => {
      const rail = document.querySelector('[data-booking-wizard-navigation]');
      if (!(rail instanceof HTMLElement)) throw new Error('Expected booking navigation rail');
      const topBoundary = Array.from(document.querySelectorAll('body *'))
        .filter((candidate) => {
          const style = getComputedStyle(candidate);
          const box = candidate.getBoundingClientRect();
          return (
            (style.position === 'fixed' || style.position === 'sticky') &&
            box.top <= 0.5 &&
            box.bottom > 0 &&
            box.height < innerHeight / 2
          );
        })
        .reduce((boundary, candidate) => {
          return Math.max(boundary, candidate.getBoundingClientRect().bottom);
        }, 0);
      const box = element.getBoundingClientRect();
      const railTop = rail.getBoundingClientRect().top;
      if (box.top >= topBoundary && box.bottom <= railTop) return;
      const availableHeight = railTop - topBoundary;
      const desiredTop = topBoundary + Math.max(0, (availableHeight - box.height) / 2);
      window.scrollBy({ top: box.top - desiredTop });
    });
  }
  if (settle) {
    await waitForSettledLocator(locator);
    await waitForSettledLocator(page.locator('[data-booking-wizard-navigation]'));
  }
  const evidence = await locator.evaluate((element, evidenceLabel) => {
    const rail = document.querySelector('[data-booking-wizard-navigation]');
    if (!(rail instanceof HTMLElement)) throw new Error('Expected booking navigation rail');
    const box = element.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    const topBoundary = Array.from(document.querySelectorAll('body *'))
      .filter((candidate) => {
        const style = getComputedStyle(candidate);
        const candidateBox = candidate.getBoundingClientRect();
        return (
          (style.position === 'fixed' || style.position === 'sticky') &&
          candidateBox.top <= 0.5 &&
          candidateBox.bottom > 0 &&
          candidateBox.height < innerHeight / 2
        );
      })
      .reduce((boundary, candidate) => {
        return Math.max(boundary, candidate.getBoundingClientRect().bottom);
      }, 0);
    return {
      label: evidenceLabel,
      element: { top: box.top, right: box.right, bottom: box.bottom, left: box.left },
      topBoundary,
      railTop: railBox.top,
      viewportHeight: innerHeight,
      viewportWidth: innerWidth,
      overlap: Math.max(0, box.bottom - railBox.top),
    };
  }, label);
  expect(evidence.element.top).toBeGreaterThanOrEqual(evidence.topBoundary);
  expect(evidence.element.left).toBeGreaterThanOrEqual(0);
  expect(evidence.element.right).toBeLessThanOrEqual(evidence.viewportWidth);
  expect(evidence.element.bottom).toBeLessThanOrEqual(evidence.viewportHeight);
  expect(evidence.overlap).toBe(0);
  return evidence;
}

export async function assertTopCaptureFraming(
  page: Page,
  heading: Locator,
  label: string,
): Promise<ElementRailEvidence> {
  await waitForSettledLocator(heading);
  await waitForSettledLocator(page.locator('[data-booking-wizard-navigation]'));
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'auto' });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await waitForSettledLocator(heading);
  await waitForSettledLocator(page.locator('[data-booking-wizard-navigation]'));
  const evidence = await assertElementAboveRail(page, heading, label, false, false);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  return evidence;
}

export async function collectFocusedAxeColorContrast(
  page: Page,
  locator: Locator,
): Promise<FocusedAxeEvidence> {
  const axeIsReady = await page.evaluate(() => typeof Reflect.get(window, 'axe') === 'object');
  if (!axeIsReady) await page.addScriptTag({ content: axeSource });
  return locator.evaluate(async (element) => {
    const mapFindings = (findings: unknown) => {
      if (!Array.isArray(findings)) throw new Error('Invalid axe findings result');
      return findings.map((finding) => {
        const nodes = Reflect.get(finding, 'nodes');
        return {
          id: String(Reflect.get(finding, 'id')),
          nodes: Array.isArray(nodes)
            ? nodes.map((node) => ({
                failureSummary: String(Reflect.get(node, 'failureSummary') ?? ''),
                html: String(Reflect.get(node, 'html') ?? ''),
                target: Reflect.get(node, 'target'),
              }))
            : [],
        };
      });
    };
    const axeValue = Reflect.get(window, 'axe');
    const run = Reflect.get(axeValue, 'run');
    if (typeof run !== 'function') throw new Error('axe-core did not initialize');
    const results = await Reflect.apply(run, axeValue, [
      element,
      { runOnly: { type: 'rule', values: ['color-contrast'] } },
    ]);
    const violations = mapFindings(Reflect.get(results, 'violations'));
    const incomplete = mapFindings(Reflect.get(results, 'incomplete'));
    const passes = mapFindings(Reflect.get(results, 'passes'));
    return {
      ruleId: 'color-contrast',
      violations,
      incomplete,
      passes,
      passed: violations.length === 0 && incomplete.length === 0 && passes.length > 0,
    };
  });
}

export async function assertNoSeriousAxeViolations(page: Page): Promise<void> {
  const axeIsReady = await page.evaluate(() => typeof Reflect.get(window, 'axe') === 'object');
  if (!axeIsReady) await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const axeValue = Reflect.get(window, 'axe');
    const run = Reflect.get(axeValue, 'run');
    const results = await Reflect.apply(run, axeValue, [document]);
    const findings = Reflect.get(results, 'violations');
    if (!Array.isArray(findings)) return [{ id: 'axe-result-invalid', nodes: [] }];
    return findings
      .filter((finding) => {
        const impact = Reflect.get(finding, 'impact');
        return impact === 'serious' || impact === 'critical';
      })
      .map((finding) => {
        const nodes = Reflect.get(finding, 'nodes');
        return {
          id: String(Reflect.get(finding, 'id')),
          nodes: Array.isArray(nodes)
            ? nodes.map((node) => ({
                failureSummary: String(Reflect.get(node, 'failureSummary')),
                html: String(Reflect.get(node, 'html')),
                target: Reflect.get(node, 'target'),
              }))
            : [],
        };
      });
  });
  expect(violations).toEqual([]);
}
