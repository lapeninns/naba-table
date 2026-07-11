import { describe, expect, it } from 'vitest';

import { storageKeys } from '@shared/booking/storage';

describe('storageKeys', () => {
  it('pins the remembered-contacts localStorage key @contract @smoke', () => {
    // useRememberedContacts persists guest PII under this key; renaming it
    // silently orphans stored contacts, so the value is contract-locked.
    expect(storageKeys.contacts).toBe('bookingflow-contacts');
  });
});
