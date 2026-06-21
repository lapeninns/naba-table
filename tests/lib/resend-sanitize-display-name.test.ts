import { describe, expect, it } from 'vitest';

import { sanitizeDisplayName } from '@/libs/resend';

// triage-042: the From-header display name must be sanitized so a tenant-controlled
// restaurant name cannot inject headers or smuggle a second address.
describe('sanitizeDisplayName (triage-042)', () => {
  it('strips CR/LF so a header/BCC injection cannot be smuggled into the From name', () => {
    const result = sanitizeDisplayName('Acme\r\nBcc: x@y.com');
    expect(result).toBeDefined();
    expect(result).not.toContain('\r');
    expect(result).not.toContain('\n');
    expect(result).not.toContain('@');
  });

  it('removes angle brackets and embedded email fragments so a fake address cannot be appended', () => {
    const result = sanitizeDisplayName('Foo <evil@x>') ?? '';
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('@');
  });

  it('caps over-long input at 128 characters', () => {
    const result = sanitizeDisplayName('a'.repeat(500)) ?? '';
    expect(result.length).toBeLessThanOrEqual(128);
  });

  it('preserves a normal display name', () => {
    expect(sanitizeDisplayName('The Atomic Arms')).toBe('The Atomic Arms');
  });

  it('returns undefined when nothing usable remains', () => {
    expect(sanitizeDisplayName('   ')).toBeUndefined();
    expect(sanitizeDisplayName(null)).toBeUndefined();
    expect(sanitizeDisplayName(undefined)).toBeUndefined();
  });
});
