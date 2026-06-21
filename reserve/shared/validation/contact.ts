import parsePhoneNumberFromString from 'libphonenumber-js/min';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_UK_PHONE_COUNTRIES = new Set(['GB', 'IM', 'GG', 'JE']);
const FALLBACK_UK_NATIONAL_REGEX =
  /^(?:1(?!632)\d{8,9}|2\d{8,9}|3\d{8,9}|5[56]\d{8}|7\d{9}|8\d{9}|9\d{9})$/;

type ParsedUKPhone = {
  country?: string;
  number: string;
  isValid: () => boolean;
};

// Matches the database constraint: customers_phone_check
export const CUSTOMER_PHONE_LENGTH_MIN = 7;
export const CUSTOMER_PHONE_LENGTH_MAX = 20;

function normalizeFallbackUKPhone(value: string): ParsedUKPhone | null {
  const digits = value.replace(/\D/g, '');
  const national = digits.startsWith('0044')
    ? digits.slice(4)
    : digits.startsWith('44')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : null;

  if (!national || !FALLBACK_UK_NATIONAL_REGEX.test(national)) {
    return null;
  }

  return {
    country: 'GB',
    number: `+44${national}`,
    isValid: () => true,
  };
}

function parseGBPhone(value: string): ParsedUKPhone | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let phone: ParsedUKPhone | undefined;
  try {
    phone = parsePhoneNumberFromString(trimmed, 'GB');
  } catch {
    phone = normalizeFallbackUKPhone(trimmed) ?? undefined;
  }

  if (!phone || !phone.isValid()) {
    return null;
  }
  if (!phone.country || !SUPPORTED_UK_PHONE_COUNTRIES.has(phone.country)) {
    return null;
  }
  return phone;
}

export function isUKPhone(value: string): boolean {
  if (!value) return false;
  return parseGBPhone(value) !== null;
}

export function formatUKPhoneToE164(value: string | null | undefined): string | null {
  if (!value) return null;
  const phone = parseGBPhone(value);
  return phone ? phone.number : null;
}

export function normalizeComparablePhone(value: string | null | undefined): string {
  if (!value) return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  const canonical = formatUKPhoneToE164(trimmed);
  if (canonical) {
    return canonical.replace(/^\+/, '');
  }

  return trimmed.replace(/[^0-9]/g, '');
}

export function isEmail(value: string): boolean {
  if (!value) return false;
  return EMAIL_REGEX.test(value);
}

export const contactValidation = {
  isUKPhone,
  formatUKPhoneToE164,
  normalizeComparablePhone,
  isEmail,
  CUSTOMER_PHONE_LENGTH_MIN,
  CUSTOMER_PHONE_LENGTH_MAX,
};
