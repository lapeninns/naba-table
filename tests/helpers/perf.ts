import type { Page } from '@playwright/test';

export async function instrumentLCP(page: Page) {
  await page.addInitScript(() => {
    const entries: PerformanceEntry[] = [];
    window.__lcpEntries = entries;
    new PerformanceObserver((list) => {
      entries.push(...list.getEntries());
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
}

declare global {
  interface Window {
    __lcpEntries?: PerformanceEntry[];
  }
}
