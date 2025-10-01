const UK_PHONE_REGEX = /^(?:\+44|44|0)7\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
};
