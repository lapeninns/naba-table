import { describe, expect, it } from 'vitest';

import { describeAccountDevice } from '@/lib/account/session-device';

describe('describeAccountDevice', () => {
  it('identifies Chrome on Windows as a desktop device', () => {
    const device = describeAccountDevice(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    );

    expect(device).toEqual({
      kind: 'desktop',
      browser: 'Chrome 126',
      operatingSystem: 'Windows 10 or 11',
      label: 'Chrome 126 on Windows 10 or 11',
    });
  });

  it('identifies Safari on iPhone as a mobile device', () => {
    const device = describeAccountDevice(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    );

    expect(device.kind).toBe('mobile');
    expect(device.browser).toBe('Safari 17');
    expect(device.operatingSystem).toBe('iOS 17.5');
  });

  it('does not misclassify Edge as Chrome', () => {
    const device = describeAccountDevice(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    );

    expect(device.browser).toBe('Edge 126');
  });

  it('identifies Android tablets without a mobile marker', () => {
    const device = describeAccountDevice(
      'Mozilla/5.0 (Linux; Android 13; Pixel C) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    );

    expect(device.kind).toBe('tablet');
    expect(device.operatingSystem).toBe('Android 13');
  });

  it('uses a safe fallback when the user agent is missing', () => {
    expect(describeAccountDevice(null)).toEqual({
      kind: 'unknown',
      browser: 'Unknown browser',
      operatingSystem: 'Unknown OS',
      label: 'Unknown device',
    });
  });
});
