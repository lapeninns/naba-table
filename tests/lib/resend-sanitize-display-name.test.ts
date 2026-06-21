import { describe, expect, it, vi } from 'vitest';

// libs/resend.ts reads env/config at module load and pulls in server-side deps.
// Stub them so we can import the pure sanitizeDisplayName helper in isolation.
vi.mock('@/config', () => ({
  default: {
    appName: 'Nab a Table',
    email: {
      supportEmail: 'support@nabatable.com',
    },
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    resend: {
      apiKey: null,
      from: 'Nab a Table <hello@nabatable.com>',
      useMock: true,
    },
  },
}));

vi.mock('@/server/customers', () => ({
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
}));

vi.mock('@/server/emails/recipient-suppression', () => ({
  getSuppressedRecipientEmails: vi.fn(async () => []),
}));

vi.mock('@/server/emails/email-suppression-list', () => ({
  getEmailSuppressionStates: vi.fn(async () => ({ hard: [], soft: [] })),
}));

vi.mock('@/server/emails/list-unsubscribe', () => ({
  buildListUnsubscribeHeaders: vi.fn(() => ({})),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(async () => {}),
}));

import { sanitizeDisplayName } from '@/libs/resend';

describe('sanitizeDisplayName', () => {
  it('strips CR/LF so a header/BCC injection cannot be smuggled into the From name', () => {
    const result = sanitizeDisplayName('Acme\r\nBcc: x@y.com') ?? '';

    // The injection vector is the line break that would start a new header.
    // Once CR/LF are gone the remaining text is inert display-name content.
    expect(result).not.toContain('\r');
    expect(result).not.toContain('\n');
    // The embedded address fragment must not survive as a usable address either.
    expect(result).not.toContain('@');
  });

  it('removes angle brackets and embedded email fragments so a fake address cannot be appended', () => {
    const result = sanitizeDisplayName('Foo <evil@x>');

    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('@');
    expect(result).toContain('Foo');
  });

  it('caps over-long input', () => {
    const result = sanitizeDisplayName('a'.repeat(500));

    expect(result.length).toBeLessThanOrEqual(128);
  });

  it('preserves a normal display name', () => {
    expect(sanitizeDisplayName('The Atomic Arms')).toBe('The Atomic Arms');
  });
});
