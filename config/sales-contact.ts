const SALES_EMAIL = 'amanshresthaaaaa@gmail.com';
const SALES_PHONE = '07467586751';

function formatPhoneForTel(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export const salesContact = {
  email: SALES_EMAIL,
  phone: SALES_PHONE,
  phoneHref: `tel:${formatPhoneForTel(SALES_PHONE)}`,
} as const;
