import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { extractClientIp } from '@/server/security/request';

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

  it('uses trusted platform IP headers when request IP is not populated', () => {
    const request = new NextRequest('https://www.nabatable.com/api/availability', {
      headers: {
        'cf-connecting-ip': '198.51.100.20',
        'x-forwarded-for': '203.0.113.50',
      },
    });

    expect(extractClientIp(request)).toBe('198.51.100.20');
  });

  it('ignores malformed trusted IP headers', () => {
    const request = new NextRequest('https://www.nabatable.com/api/availability', {
      headers: {
        'cf-connecting-ip': '999.51.100.20',
      },
    });

    expect(extractClientIp(request)).toBe('unknown');
  });

  it('uses generic forwarded IP headers only when explicitly trusted', () => {
    const previous = process.env.TRUST_FORWARDED_IP_HEADERS;
    process.env.TRUST_FORWARDED_IP_HEADERS = 'true';

    try {
      const request = new NextRequest('https://www.nabatable.com/api/availability', {
        headers: {
          'x-forwarded-for': '198.51.100.20, 10.0.0.1',
        },
      });

      expect(extractClientIp(request)).toBe('198.51.100.20');
    } finally {
      if (previous === undefined) {
        delete process.env.TRUST_FORWARDED_IP_HEADERS;
      } else {
        process.env.TRUST_FORWARDED_IP_HEADERS = previous;
      }
    }
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
