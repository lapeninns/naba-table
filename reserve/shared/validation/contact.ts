import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Matches the database constraint: customers_phone_check
export const CUSTOMER_PHONE_LENGTH_MIN = 7;
export const CUSTOMER_PHONE_LENGTH_MAX = 20;

function parseGBPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const phone = parsePhoneNumberFromString(trimmed, 'GB');
  if (!phone || !phone.isValid()) {
    return null;
  }
  if (phone.country !== 'GB') {
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

export function isEmail(value: string): boolean {
  if (!value) return false;
  return EMAIL_REGEX.test(value);
}

export const contactValidation = {
  isUKPhone,
  formatUKPhoneToE164,
  isEmail,
  CUSTOMER_PHONE_LENGTH_MIN,
  CUSTOMER_PHONE_LENGTH_MAX,
};
