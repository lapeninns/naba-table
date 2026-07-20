import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAccountDeviceHeartbeat } from '@/lib/account/device-identity';

describe('account device identity', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists one random first-party identifier per account', () => {
    const randomUUID = vi
      .spyOn(window.crypto, 'randomUUID')
      .mockReturnValue('88888888-8888-4888-8888-000000000001');

    const first = getAccountDeviceHeartbeat('user-1');
    const second = getAccountDeviceHeartbeat('user-1');

    expect(first.deviceId).toBe('88888888-8888-4888-8888-000000000001');
    expect(second.deviceId).toBe(first.deviceId);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(window.localStorage).toHaveLength(1);
  });

  it('does not correlate different accounts on the same browser', () => {
    vi.spyOn(window.crypto, 'randomUUID')
      .mockReturnValueOnce('88888888-8888-4888-8888-000000000001')
      .mockReturnValueOnce('88888888-8888-4888-8888-000000000002');

    const firstAccount = getAccountDeviceHeartbeat('user-1');
    const secondAccount = getAccountDeviceHeartbeat('user-2');

    expect(firstAccount.deviceId).not.toBe(secondAccount.deviceId);
    expect(window.localStorage).toHaveLength(2);
  });
});
