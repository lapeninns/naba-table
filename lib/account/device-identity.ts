import type { AccountSessionHeartbeat } from './session-schema';

const DEVICE_ID_STORAGE_VERSION = 'v1';

function getStorageKey(userId: string): string {
  return `nabatable:account-device:${userId}:${DEVICE_ID_STORAGE_VERSION}`;
}

function getOrCreateDeviceId(userId: string): string | null {
  try {
    const key = getStorageKey(userId);
    const stored = window.localStorage.getItem(key);
    if (stored) return stored;

    const created = window.crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return null;
  }
}

function getTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function getAccountDeviceHeartbeat(userId: string): AccountSessionHeartbeat {
  return {
    deviceId: getOrCreateDeviceId(userId),
    timeZone: getTimeZone(),
    locale: window.navigator.language || null,
  };
}
