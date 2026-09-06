import { test as base, expect } from '@playwright/test';

import { stagingEnv } from './env';
import { safeStagingTransport, withStagingProtection } from './protection';

export { expect };
export const test = base.extend({
  request: async ({ request }, runFixture) => {
    const staging = stagingEnv();
    await runFixture(
      withStagingProtection(
        request,
        staging.publicUrl,
        staging.opsUrl,
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      ),
    );
  },
  page: async ({ page }, runFixture) => {
    const staging = stagingEnv();
    const allowed = new Set([new URL(staging.publicUrl).origin, new URL(staging.opsUrl).origin]);
    const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (secret) {
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (!allowed.has(url.origin)) {
          await route.continue();
          return;
        }
        // Fetch one hop, then let the browser navigate the response's redirect through
        // this origin guard again. This prevents forwarding the bypass to another host.
        await safeStagingTransport(route.request().method(), url.origin, async () => {
          const response = await route.fetch({
            headers: { ...route.request().headers(), 'x-vercel-protection-bypass': secret },
            maxRedirects: 0,
          });
          await route.fulfill({ response });
        });
      });
    }
    await runFixture(page);
  },
});
