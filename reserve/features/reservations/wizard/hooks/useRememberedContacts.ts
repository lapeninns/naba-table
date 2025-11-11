import { useEffect } from 'react';

import { storageKeys } from '@reserve/shared/booking';

import { useWizardDependencies } from '../di';

import type { BookingDetails } from '../model/reducer';
import type { WizardActions } from '../model/store';

type ContactDetails = Pick<BookingDetails, 'name' | 'email' | 'phone' | 'rememberDetails'>;

type RememberedContactsConfig = {
  details: ContactDetails;
  actions: Pick<WizardActions, 'hydrateContacts' | 'updateDetails'>;
  enabled?: boolean;
};

const STORAGE_KEY = storageKeys.contacts;
const CONTACT_VERSION = 1;
const REMEMBERED_CONTACT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type StoredContacts = {
  version: typeof CONTACT_VERSION;
  savedAt: number;
  expiresAt: number;
  remember: boolean;
  data: Pick<BookingDetails, 'name' | 'email' | 'phone'>;
};

const sanitizeContactValue = (value: string) => value.trim();

const normalizeContactPayload = (details: ContactDetails): StoredContacts | null => {
  const name = sanitizeContactValue(details.name);
  const email = sanitizeContactValue(details.email);
  const phone = sanitizeContactValue(details.phone);

  if (!name && !email && !phone) {
    return null;
  }

  return {
    version: CONTACT_VERSION,
    savedAt: Date.now(),
    expiresAt: Date.now() + REMEMBERED_CONTACT_TTL_MS,
    remember: details.rememberDetails,
    data: { name, email, phone },
  };
};

const readStoredContacts = (): StoredContacts | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredContacts | undefined;
    if (!parsed || parsed.version !== CONTACT_VERSION || !parsed.data) {
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

const writeStoredContacts = (payload: StoredContacts | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!payload) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[remembered-contacts] failed to persist payload', error);
  }
};

export const useRememberedContacts = ({
  details,
  actions,
  enabled = true,
}: RememberedContactsConfig) => {
  const { errorReporter } = useWizardDependencies();

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      const stored = readStoredContacts();
      if (!stored) return;

      const { data, remember } = stored;
      const name = typeof data.name === 'string' ? data.name : '';
      const email = typeof data.email === 'string' ? data.email : '';
      const phone = typeof data.phone === 'string' ? data.phone : '';

      if (name || email || phone) {
        actions.hydrateContacts({ name, email, phone, rememberDetails: remember ?? true });
      }
    } catch (error) {
      errorReporter.capture(error, { scope: 'rememberedContacts.hydrate' });
    }
  }, [actions, enabled, errorReporter]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      if (!details.rememberDetails) {
        writeStoredContacts(null);
        return;
      }

      const sanitized = normalizeContactPayload(details);
      writeStoredContacts(sanitized);
    } catch (error) {
      errorReporter.capture(error, { scope: 'rememberedContacts.persist' });
    }
  }, [details, enabled, errorReporter]);
};
