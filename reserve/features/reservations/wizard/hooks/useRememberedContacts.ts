import { useEffect } from 'react';

import { storageKeys } from '@reserve/shared/booking';

import { useWizardDependencies } from '../di';

import type { BookingDetails } from '../model/reducer';
import type { WizardActions } from '../model/store';

type ContactDetails = Pick<BookingDetails, 'name' | 'email' | 'phone' | 'rememberDetails'>;

type RememberedContactsConfig = {
  details: ContactDetails;
  actions: Pick<WizardActions, 'hydrateContacts' | 'updateDetails'>;
};

const STORAGE_KEY = storageKeys.contacts;

const sanitizeContactValue = (value: string) => value.trim();

export const useRememberedContacts = ({ details, actions }: RememberedContactsConfig) => {
  const { errorReporter } = useWizardDependencies();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<ContactDetails> | null;
      if (!parsed) return;

      const name = typeof parsed.name === 'string' ? sanitizeContactValue(parsed.name) : '';
      const email = typeof parsed.email === 'string' ? sanitizeContactValue(parsed.email) : '';
      const phone = typeof parsed.phone === 'string' ? sanitizeContactValue(parsed.phone) : '';

      if (name || email || phone) {
        actions.hydrateContacts({ name, email, phone, rememberDetails: true });
      }
    } catch (error) {
      errorReporter.capture(error, { scope: 'rememberedContacts.hydrate' });
    }
  }, [actions, errorReporter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (details.rememberDetails) {
        const payload = {
          name: sanitizeContactValue(details.name),
          email: sanitizeContactValue(details.email),
          phone: sanitizeContactValue(details.phone),
        } satisfies Omit<ContactDetails, 'rememberDetails'>;

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      errorReporter.capture(error, { scope: 'rememberedContacts.persist' });
    }
  }, [details.email, details.name, details.phone, details.rememberDetails, errorReporter]);
};
