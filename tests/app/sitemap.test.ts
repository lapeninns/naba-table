import { describe, expect, it } from 'vitest';

import sitemap from '@src/app/sitemap';

describe('app sitemap', () => {
  it('omits the deprecated guest thank-you alias while keeping canonical booking routes', () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).not.toContain('https://shipfa.st/guest/thank-you');
    expect(urls).toContain('https://shipfa.st/guest/bookings');
    expect(urls).toContain('https://shipfa.st/auth/signin');
  });
});
