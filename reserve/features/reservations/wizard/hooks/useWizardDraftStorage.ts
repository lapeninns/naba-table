import type { BookingDetails } from '../model/reducer';

const DRAFT_STORAGE_KEY = 'reserve.wizard.draft';
const CONTACT_STORAGE_KEY = 'reserve.wizard.contacts';
export const WIZARD_DRAFT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type StoredDraft = {
  version: 1;
  savedAt: number;
  expiresAt: number;
  details: BookingDetails;
};

const CURRENT_VERSION = 1;
const CONTACT_VERSION = 1;

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

const buildContactStorageKey = (slug: string | null | undefined): string => {
  const normalized = normalizeSlug(slug);
  return normalized ? `${CONTACT_STORAGE_KEY}.${normalized}` : CONTACT_STORAGE_KEY;
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

const parseStoredContact = (raw: string | null): StoredContact | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredContact | undefined;
    if (!parsed || parsed.version !== CONTACT_VERSION || !parsed.data) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const sanitizeContactValue = (value: string | null | undefined): string => value?.trim() ?? '';

const saveContactDraft = (
  details: Pick<BookingDetails, 'name' | 'email' | 'phone'>,
  slug: string | null | undefined,
  expiresAt: number,
) => {
  if (!isBrowser()) {
    return;
  }

  const payload: StoredContact = {
    version: CONTACT_VERSION,
    savedAt: Date.now(),
    expiresAt,
    slug: normalizeSlug(slug),
    data: {
      name: sanitizeContactValue(details.name),
      email: sanitizeContactValue(details.email),
      phone: sanitizeContactValue(details.phone),
    },
  };

  try {
    window.sessionStorage.setItem(buildContactStorageKey(slug), JSON.stringify(payload));
  } catch {
    // Ignore session storage failures.
  }
};

const loadContactDraft = (slug: string | null | undefined): StoredContact | null => {
  if (!isBrowser()) {
    return null;
  }

  const key = buildContactStorageKey(slug);
  const parsed = parseStoredContact(window.sessionStorage.getItem(key));
  if (!parsed) {
    return null;
  }

  if (parsed.expiresAt <= Date.now()) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore cleanup errors
    }
    return null;
  }

  return parsed;
};

const clearContactDraft = (slug: string | null | undefined, includeLegacy = true) => {
  if (!isBrowser()) {
    return;
  }

  const removeKey = (key: string) => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  if (slug) {
    removeKey(buildContactStorageKey(slug));
  }
  if (includeLegacy) {
    removeKey(CONTACT_STORAGE_KEY);
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

type StoredContact = {
  version: typeof CONTACT_VERSION;
  savedAt: number;
  expiresAt: number;
  slug: string | null;
  data: Pick<BookingDetails, 'name' | 'email' | 'phone'>;
};

const readDraftFromKey = (key: string): LoadedDraft | null => {
  if (!isBrowser()) {
    return null;
  }
  const parsed = parseStoredDraft(window.localStorage.getItem(key));
  if (!parsed) {
    return null;
  }

  let needsRewrite = false;
  if (parsed.details) {
    const legacyContact = {
      name: parsed.details.name,
      email: parsed.details.email,
      phone: parsed.details.phone,
    };

    if (legacyContact.name || legacyContact.email || legacyContact.phone) {
      saveContactDraft(
        {
          name: legacyContact.name ?? '',
          email: legacyContact.email ?? '',
          phone: legacyContact.phone ?? '',
        },
        normalizeSlug(parsed.details.restaurantSlug),
        parsed.expiresAt,
      );
      needsRewrite = true;
    }

    if (parsed.details.name) {
      parsed.details.name = '';
    }
    if (parsed.details.email) {
      parsed.details.email = '';
    }
    if (parsed.details.phone) {
      parsed.details.phone = '';
    }
  }

  if (needsRewrite) {
    try {
      window.localStorage.setItem(key, JSON.stringify(parsed));
    } catch {
      // ignore rewrite failures
    }
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
      return mergeDraftWithContacts(namespacedDraft, normalizedExpectedSlug);
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

  return mergeDraftWithContacts(legacyDraft, normalizedExpectedSlug);
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
    details: {
      ...details,
      name: '',
      email: '',
      phone: '',
    },
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    saveContactDraft(details, normalizedSlug, payload.expiresAt);
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
      clearContactDraft(normalizedSlug, false);
    }
    if (includeLegacy) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      clearContactDraft(null, true);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wizard-draft] failed to clear draft', error);
    }
  }
}

const mergeDraftWithContacts = (draft: LoadedDraft, expectedSlug: string | null): LoadedDraft => {
  const contactSlug = normalizeSlug(draft.details.restaurantSlug) ?? expectedSlug;
  const storedContacts = loadContactDraft(contactSlug);
  if (!storedContacts) {
    return draft;
  }

  return {
    ...draft,
    details: {
      ...draft.details,
      ...storedContacts.data,
    },
  };
};
