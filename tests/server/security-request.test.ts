import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { extractClientIp } from '@/server/security/request';

describe('security request helpers', () => {
  it('does not trust client-controlled forwarded IP headers', () => {
    const request = new NextRequest('https://www.nabatable.com/api/availability', {
      headers: {
        'x-forwarded-for': '198.51.100.20, 10.0.0.1',
        'x-real-ip': '198.51.100.30',
      },
    });

    expect(extractClientIp(request)).toBe('unknown');
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
