import type { BookingDetails } from '../model/reducer';

const DRAFT_STORAGE_KEY = 'reserve.wizard.draft';
export const WIZARD_DRAFT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type StoredDraft = {
  version: 1;
  savedAt: number;
  expiresAt: number;
  details: BookingDetails;
};

const CURRENT_VERSION = 1;

const isBrowser = () => typeof window !== 'undefined';

export type LoadedDraft = {
  details: BookingDetails;
  expired: boolean;
  expiresAt: number;
};

export function loadWizardDraft(): LoadedDraft | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredDraft | undefined;
    if (!parsed || parsed.version !== CURRENT_VERSION || !parsed.details) {
      return null;
    }
    const expired = parsed.expiresAt <= Date.now();
    return {
      details: parsed.details,
      expired,
      expiresAt: parsed.expiresAt,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wizard-draft] failed to load draft', error);
    }
    return null;
  }
}

export function saveWizardDraft(details: BookingDetails): void {
  if (!isBrowser()) {
    return;
  }
  const payload: StoredDraft = {
    version: CURRENT_VERSION,
    savedAt: Date.now(),
    expiresAt: Date.now() + WIZARD_DRAFT_TTL_MS,
    details,
  };
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wizard-draft] failed to persist draft', error);
    }
  }
}

export function clearWizardDraft(): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wizard-draft] failed to clear draft', error);
    }
  }
}
