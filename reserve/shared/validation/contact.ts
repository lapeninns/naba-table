const UK_PHONE_REGEX = /^(?:\+44|44|0)7\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Matches the database constraint: customers_phone_check
export const CUSTOMER_PHONE_LENGTH_MIN = 7;
export const CUSTOMER_PHONE_LENGTH_MAX = 20;

export function isUKPhone(value: string): boolean {
  if (!value) return false;
  return UK_PHONE_REGEX.test(value.replace(/\s/g, ''));
}

export function isEmail(value: string): boolean {
  if (!value) return false;
  return EMAIL_REGEX.test(value);
}

export const contactValidation = {
  isUKPhone,
  isEmail,
  CUSTOMER_PHONE_LENGTH_MIN,
  CUSTOMER_PHONE_LENGTH_MAX,
};
