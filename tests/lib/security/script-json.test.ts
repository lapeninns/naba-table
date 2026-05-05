import { describe, expect, it } from 'vitest';

import { safeJsonForHtmlScript } from '@/lib/security/script-json';

describe('safeJsonForHtmlScript', () => {
  it('escapes characters that can break out of script contexts', () => {
    const output = safeJsonForHtmlScript({
      ctaLabel: '</script><script>alert(1)</script>',
      text: 'a & b > c',
      separators: '\u2028\u2029',
    });

    expect(output).not.toContain('</script>');
    expect(output).not.toContain('<script>');
    expect(output).toContain(
      '\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e',
    );
    expect(output).toContain('\\u0026');
    expect(output).toContain('\\u003e');
    expect(output).toContain('\\u2028\\u2029');
  });
});
