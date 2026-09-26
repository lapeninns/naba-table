import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { extractClientIp, rateLimitIpKey } from '@/server/security/request';

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

describe('rateLimitIpKey', () => {
  it('keys IPv4 per address, never per /16', () => {
    expect(rateLimitIpKey('198.51.100.20')).toBe('v4:198.51.100.20');
    expect(rateLimitIpKey('198.51.7.9')).not.toBe(rateLimitIpKey('198.51.100.20'));
  });

  it('keys IPv6 per /64 so neighbours on other /64s get their own bucket', () => {
    expect(rateLimitIpKey('2001:db8:1:2:aaaa::1')).toBe('v6:2001:db8:1:2::/64');
    expect(rateLimitIpKey('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe(
      'v6:2001:db8:1:2::/64',
    );
    expect(rateLimitIpKey('2001:db8:1:3::1')).toBe('v6:2001:db8:1:3::/64');
    expect(rateLimitIpKey('2001:db8::1')).toBe('v6:2001:db8:0:0::/64');
    expect(rateLimitIpKey('::1')).toBe('v6:0:0:0:0::/64');
  });

  it('keys IPv4-mapped IPv6 as the IPv4 address', () => {
    expect(rateLimitIpKey('::ffff:198.51.100.20')).toBe('v4:198.51.100.20');
    expect(rateLimitIpKey('::ffff:c633:6414')).toBe('v4:198.51.100.20');
  });

  it('returns null instead of a shared bucket when no usable IP is known', () => {
    expect(rateLimitIpKey('unknown')).toBeNull();
    expect(rateLimitIpKey('')).toBeNull();
    expect(rateLimitIpKey(null)).toBeNull();
    expect(rateLimitIpKey(undefined)).toBeNull();
    expect(rateLimitIpKey('2001:db8::1::2')).toBeNull();
    expect(rateLimitIpKey('1:2:3:4:5:6:7:8:9')).toBeNull();
  });
});
