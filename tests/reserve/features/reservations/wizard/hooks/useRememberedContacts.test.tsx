import { renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { useRememberedContacts } from '@features/reservations/wizard/hooks/useRememberedContacts';
import { storageKeys } from '@reserve/shared/booking';

import type { BookingDetails } from '@features/reservations/wizard/model/reducer';

const STORAGE_KEY = storageKeys.contacts;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

type ContactDetails = Pick<BookingDetails, 'name' | 'email' | 'phone' | 'rememberDetails'>;

function makeDetails(overrides: Partial<ContactDetails> = {}): ContactDetails {
  return {
    name: 'Alex Guest',
    email: 'alex@example.com',
    phone: '+447123456789',
    rememberDetails: true,
    ...overrides,
  };
}

function renderRemembered(details: ContactDetails, enabled = true) {
  const hydrateContacts = vi.fn();
  const updateDetails = vi.fn();
  const capture = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WizardDependenciesProvider value={{ errorReporter: { capture } }}>
      {children}
    </WizardDependenciesProvider>
  );
  const view = renderHook(
    ({ current }: { current: ContactDetails }) =>
      useRememberedContacts({
        details: current,
        actions: { hydrateContacts, updateDetails },
        enabled,
      }),
    { initialProps: { current: details }, wrapper },
  );
  return { ...view, hydrateContacts, updateDetails, capture };
}

function readStored() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('useRememberedContacts persistence', () => {
  it('persists trimmed contacts with a six-hour TTL when remembering @contract @smoke', () => {
    renderRemembered(makeDetails({ name: '  Alex Guest  ' }));

    const stored = readStored();
    expect(stored).not.toBeNull();
    expect(stored?.version).toBe(1);
    expect(stored?.remember).toBe(true);
    expect(stored?.data).toEqual({
      name: 'Alex Guest',
      email: 'alex@example.com',
      phone: '+447123456789',
    });
    expect(stored?.expiresAt).toBe(Date.now() + SIX_HOURS_MS);
  });

  it('removes the stored payload when remembering is turned off @contract', () => {
    const { rerender } = renderRemembered(makeDetails());
    expect(readStored()).not.toBeNull();

    rerender({ current: makeDetails({ rememberDetails: false }) });

    expect(readStored()).toBeNull();
  });

  it('stores nothing when every contact field is blank @contract', () => {
    renderRemembered(makeDetails({ name: '  ', email: '', phone: '' }));
    expect(readStored()).toBeNull();
  });

  it('survives storage quota failures without crashing @contract', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => renderRemembered(makeDetails())).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      '[remembered-contacts] failed to persist payload',
      expect.anything(),
    );

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('does nothing when disabled @contract', () => {
    const { hydrateContacts } = renderRemembered(makeDetails(), false);
    expect(readStored()).toBeNull();
    expect(hydrateContacts).not.toHaveBeenCalled();
  });
});

describe('useRememberedContacts hydration', () => {
  function seedStorage(payload: Record<string, unknown>) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  it('hydrates stored contacts into the wizard @contract', () => {
    seedStorage({
      version: 1,
      savedAt: Date.now(),
      expiresAt: Date.now() + SIX_HOURS_MS,
      remember: true,
      data: { name: 'Sam', email: 'sam@example.com', phone: '+447000000000' },
    });

    const { hydrateContacts } = renderRemembered(
      makeDetails({ name: '', email: '', phone: '', rememberDetails: false }),
    );

    expect(hydrateContacts).toHaveBeenCalledWith({
      name: 'Sam',
      email: 'sam@example.com',
      phone: '+447000000000',
      rememberDetails: true,
    });
  });

  it('drops expired payloads and clears them from storage @contract', () => {
    seedStorage({
      version: 1,
      savedAt: Date.now() - SIX_HOURS_MS - 1000,
      expiresAt: Date.now() - 1000,
      remember: true,
      data: { name: 'Sam', email: 'sam@example.com', phone: '' },
    });

    const { hydrateContacts } = renderRemembered(
      makeDetails({ name: '', email: '', phone: '', rememberDetails: false }),
    );

    expect(hydrateContacts).not.toHaveBeenCalled();
  });

  it('ignores unknown versions @contract', () => {
    seedStorage({
      version: 99,
      savedAt: Date.now(),
      expiresAt: Date.now() + SIX_HOURS_MS,
      remember: true,
      data: { name: 'Sam', email: '', phone: '' },
    });

    const { hydrateContacts } = renderRemembered(
      makeDetails({ name: '', email: '', phone: '', rememberDetails: false }),
    );

    expect(hydrateContacts).not.toHaveBeenCalled();
  });

  it('recovers from corrupted JSON by clearing the entry @contract', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');

    const { hydrateContacts } = renderRemembered(
      makeDetails({ name: '', email: '', phone: '', rememberDetails: false }),
    );

    expect(hydrateContacts).not.toHaveBeenCalled();
    // The write pass runs after hydration; with rememberDetails false the key
    // stays removed rather than repopulated with the corrupt payload.
    expect(readStored()).toBeNull();
  });
});
