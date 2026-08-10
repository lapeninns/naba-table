import { expect, test } from '@playwright/test';

import { getPosthogCookieExpiryDomains } from '../../lib/posthog/provider';

test('sensitive navigation expiry variants remove a parent-domain PostHog cookie', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: 'ph_domain_posthog',
      value: 'persisted-identity',
      domain: '.example.test',
      path: '/',
    },
  ]);
  const page = await context.newPage();
  await page.route('http://app.example.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<main>sensitive boundary</main>' }),
  );
  await page.goto('http://app.example.test/app/settings/restaurant/google-business-profile');

  const before = await context.cookies();
  expect(before.map(({ name }) => name)).toContain('ph_domain_posthog');

  const domains = getPosthogCookieExpiryDomains('app.example.test');
  await page.evaluate((expiryDomains) => {
    for (const domain of expiryDomains) {
      const domainAttribute = domain ? `; Domain=${domain}` : '';
      document.cookie = `ph_domain_posthog=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/${domainAttribute}; SameSite=Lax`;
    }
  }, domains);

  const after = await context.cookies();
  expect(after.map(({ name }) => name)).not.toContain('ph_domain_posthog');
  await testInfo.attach('cookie-domain-expiry.json', {
    body: JSON.stringify({
      hostname: 'app.example.test',
      expiryDomains: domains,
      before: before.map(({ domain, name }) => ({ domain, name })),
      after: after.map(({ domain, name }) => ({ domain, name })),
    }),
    contentType: 'application/json',
  });
  await context.close();
});
