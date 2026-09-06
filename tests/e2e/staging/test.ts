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
    const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (secret) {
      for (const origin of [staging.publicUrl, staging.opsUrl]) {
        // Vercel issues a secure, host-only browser cookie. Subsequent navigations use
        // normal browser networking, with no globally forwarded secret headers.
        const response = await safeStagingTransport('GET', origin, () =>
          page.context().request.get(`${origin}/api/ready`, {
            headers: {
              'x-vercel-protection-bypass': secret,
              'x-vercel-set-bypass-cookie': 'true',
            },
            maxRedirects: 0,
          }),
        );
        expect(response.status(), 'Vercel browser protection cookie bootstrap').toBe(307);
        const cookies = await page.context().cookies(origin);
        expect(
          cookies.some(
            (cookie) =>
              cookie.name === '_vercel_jwt' &&
              cookie.domain === new URL(origin).hostname &&
              cookie.secure &&
              cookie.httpOnly,
          ),
          'Vercel protection cookie must be scoped to this exact staging host',
        ).toBe(true);
      }
    }
    await runFixture(page);
  },
});
