import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { extractClientIp } from '@/server/security/request';

function withTrustedForwardedHeaders<T>(callback: () => T): T {
  const previous = process.env.TRUST_FORWARDED_IP_HEADERS;
  process.env.TRUST_FORWARDED_IP_HEADERS = 'true';

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env.TRUST_FORWARDED_IP_HEADERS;
    } else {
      process.env.TRUST_FORWARDED_IP_HEADERS = previous;
    }
  }
}

describe('security request helpers', () => {
  it('does not trust generic forwarded IP headers by default', () => {
    const request = new NextRequest('https://www.nabatable.com/api/availability', {
      headers: {
        'x-forwarded-for': '198.51.100.20, 10.0.0.1',
        'x-real-ip': '198.51.100.30',
      },
    });

    expect(extractClientIp(request)).toBe('unknown');
  });

  it('does not trust platform IP headers by default', () => {
    const request = new NextRequest('https://www.nabatable.com/api/availability', {
      headers: {
        'cf-connecting-ip': '198.51.100.20',
        'true-client-ip': '198.51.100.30',
        'x-vercel-forwarded-for': '198.51.100.40',
        'x-forwarded-for': '203.0.113.50',
      },
    });

    expect(extractClientIp(request)).toBe('unknown');
  });

  it('ignores malformed trusted IP headers', () => {
    withTrustedForwardedHeaders(() => {
      const request = new NextRequest('https://www.nabatable.com/api/availability', {
        headers: {
          'cf-connecting-ip': '999.51.100.20',
        },
      });

      expect(extractClientIp(request)).toBe('unknown');
    });
  });

  it('uses forwarded IP headers only when explicitly trusted', () => {
    withTrustedForwardedHeaders(() => {
      const request = new NextRequest('https://www.nabatable.com/api/availability', {
        headers: {
          'cf-connecting-ip': '198.51.100.30',
          'x-forwarded-for': '198.51.100.20, 10.0.0.1',
        },
      });

      expect(extractClientIp(request)).toBe('198.51.100.30');
    });
  });

  it('falls back through trusted forwarded header names when explicitly trusted', () => {
    withTrustedForwardedHeaders(() => {
      const request = new NextRequest('https://www.nabatable.com/api/availability', {
        headers: {
          'x-vercel-forwarded-for': '198.51.100.40',
          'x-forwarded-for': '203.0.113.50',
        },
      });

      expect(extractClientIp(request)).toBe('198.51.100.40');
    });
  });

  it('keeps runtime-provided request IP ahead of trusted forwarded headers', () => {
    withTrustedForwardedHeaders(() => {
      const request = new NextRequest('https://www.nabatable.com/api/availability', {
        headers: {
          'cf-connecting-ip': '198.51.100.20',
        },
      });
      Object.defineProperty(request, 'ip', {
        configurable: true,
        value: '203.0.113.10',
      });

      expect(extractClientIp(request)).toBe('203.0.113.10');
    });
  });

  it('ignores malformed runtime-provided request IP values', () => {
    const request = new NextRequest('https://www.nabatable.com/api/availability', {
      headers: {
        'cf-connecting-ip': '198.51.100.20',
      },
    });
    Object.defineProperty(request, 'ip', {
      configurable: true,
      value: 'not-an-ip',
    });

    expect(extractClientIp(request)).toBe('unknown');
  });

  it('falls back to explicitly trusted forwarded headers when runtime request IP is malformed', () => {
    withTrustedForwardedHeaders(() => {
      const request = new NextRequest('https://www.nabatable.com/api/availability', {
        headers: {
          'cf-connecting-ip': '198.51.100.20',
        },
      });
      Object.defineProperty(request, 'ip', {
        configurable: true,
        value: 'not-an-ip',
      });

      expect(extractClientIp(request)).toBe('198.51.100.20');
    });
  });

  it('uses the runtime-provided request IP when available', () => {
    const request = new NextRequest('https://www.nabatable.com/api/availability');
    Object.defineProperty(request, 'ip', {
      configurable: true,
      value: '203.0.113.10',
    });

    expect(extractClientIp(request)).toBe('203.0.113.10');
  });
});
