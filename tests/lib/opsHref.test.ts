import { describe, expect, it } from 'vitest';

import { normalizeOpsPathname, opsHref } from '@/lib/url/opsHref';

describe('opsHref', () => {
  it('prefixes canonical ops paths with /app', () => {
    expect(opsHref('/settings/restaurant/profile')).toBe('/app/settings/restaurant/profile');
    expect(opsHref('/bookings')).toBe('/app/bookings');
  });

  it('preserves search params and hash fragments', () => {
    expect(opsHref('/settings/restaurant/availability?restaurantId=rest-1#service-periods')).toBe(
      '/app/settings/restaurant/availability?restaurantId=rest-1#service-periods',
    );
  });

  it('does not double-prefix existing ops paths', () => {
    expect(opsHref('/app/email-templates')).toBe('/app/email-templates');
  });
});

describe('normalizeOpsPathname', () => {
  it('normalizes app-prefixed and bare ops paths to the same pathname', () => {
    expect(normalizeOpsPathname('/app/settings/tables')).toBe('/settings/tables');
    expect(normalizeOpsPathname('/settings/tables')).toBe('/settings/tables');
  });
});
