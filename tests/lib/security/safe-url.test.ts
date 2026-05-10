import { describe, expect, it } from 'vitest';

import {
  safeGoogleMapsUrl,
  safeGoogleReviewUrl,
  safeHttpUrl,
  safeHttpsUrl,
  safePublicHref,
} from '@/lib/security/safe-url';

describe('safe URL helpers', () => {
  it('rejects executable and local-only schemes', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:https://example.com/id',
    ]) {
      expect(safeHttpUrl(value)).toBeNull();
      expect(safeHttpsUrl(value)).toBeNull();
      expect(safeGoogleMapsUrl(value)).toBeNull();
      expect(safeGoogleReviewUrl(value)).toBeNull();
    }
  });

  it('normalizes and constrains Google maps and review URLs', () => {
    expect(safeGoogleMapsUrl(' HTTPS://MAPS.GOOGLE.COM/?q=demo ')).toBe(
      'https://maps.google.com/?q=demo',
    );
    expect(safeGoogleReviewUrl('https://search.google.com/local/writereview?placeid=abc')).toBe(
      'https://search.google.com/local/writereview?placeid=abc',
    );
    expect(safeGoogleReviewUrl('https://maps.google.com/?q=demo')).toBeNull();
    expect(safeGoogleMapsUrl('https://maps.google.com.evil.test/?q=demo')).toBeNull();
  });

  it('falls back public hrefs when schemes are unsafe', () => {
    expect(safePublicHref('javascript:alert(1)', 'https://nabatable.com/manage')).toBe(
      'https://nabatable.com/manage',
    );
    expect(safePublicHref('/restaurants/demo', 'https://nabatable.com')).toBe('/restaurants/demo');
    expect(safePublicHref('//evil.test/path', '/')).toBe('/');
  });
});
