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

const normalizeSlug = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const buildStorageKey = (slug: string | null | undefined): string => {
  const normalized = normalizeSlug(slug);
  return normalized ? `${DRAFT_STORAGE_KEY}.${normalized}` : DRAFT_STORAGE_KEY;
};

const parseStoredDraft = (raw: string | null): StoredDraft | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredDraft | undefined;
    if (!parsed || parsed.version !== CURRENT_VERSION || !parsed.details) {
      return null;
    }
    return parsed;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wizard-draft] failed to parse draft payload', error);
    }
    return null;
  }
};

type DraftSource = 'namespaced' | 'legacy';

export type LoadedDraft = {
  details: BookingDetails;
  expired: boolean;
  expiresAt: number;
  source: DraftSource;
  slugMismatch?: {
    expected: string | null;
    stored: string | null;
  };
};

const readDraftFromKey = (key: string): LoadedDraft | null => {
  if (!isBrowser()) {
    return null;
  }
  const parsed = parseStoredDraft(window.localStorage.getItem(key));
  if (!parsed) {
    return null;
  }

  return {
    details: parsed.details,
    expired: parsed.expiresAt <= Date.now(),
    expiresAt: parsed.expiresAt,
    source: key === DRAFT_STORAGE_KEY ? 'legacy' : 'namespaced',
  };
};

export function loadWizardDraft(expectedSlug?: string | null): LoadedDraft | null {
  if (!isBrowser()) {
    return null;
  }

  const normalizedExpectedSlug = normalizeSlug(expectedSlug);
  const namespacedKey = normalizedExpectedSlug ? buildStorageKey(normalizedExpectedSlug) : null;

  if (namespacedKey) {
    const namespacedDraft = readDraftFromKey(namespacedKey);
    if (namespacedDraft) {
      return namespacedDraft;
    }
  }

  const legacyDraft = readDraftFromKey(DRAFT_STORAGE_KEY);
  if (!legacyDraft) {
    return null;
  }

  if (normalizedExpectedSlug) {
    const storedSlug = normalizeSlug(legacyDraft.details.restaurantSlug);
    if (storedSlug && storedSlug !== normalizedExpectedSlug) {
      return {
        ...legacyDraft,
        slugMismatch: {
          expected: normalizedExpectedSlug,
          stored: storedSlug,
        },
      };
    }
  }

  return legacyDraft;
}

export function saveWizardDraft(details: BookingDetails): void {
  if (!isBrowser()) {
    return;
  }
  const normalizedSlug = normalizeSlug(details.restaurantSlug);
  const key = normalizedSlug ? `${DRAFT_STORAGE_KEY}.${normalizedSlug}` : DRAFT_STORAGE_KEY;
  const payload: StoredDraft = {
    version: CURRENT_VERSION,
    savedAt: Date.now(),
    expiresAt: Date.now() + WIZARD_DRAFT_TTL_MS,
    details,
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    if (key !== DRAFT_STORAGE_KEY) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wizard-draft] failed to persist draft', error);
    }
  }
}

type ClearOptions = {
  includeLegacy?: boolean;
};

export function clearWizardDraft(slug?: string | null, options?: ClearOptions): void {
  if (!isBrowser()) {
    return;
  }

  const normalizedSlug = normalizeSlug(slug);
  const includeLegacy = options?.includeLegacy ?? true;

  try {
    if (normalizedSlug) {
      window.localStorage.removeItem(buildStorageKey(normalizedSlug));
    }
    if (includeLegacy) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wizard-draft] failed to clear draft', error);
    }
  }
}
