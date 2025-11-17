import { redirect } from 'next/navigation';

import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';

export default async function LegacyCustomerDetailsRedirect() {
  const target = '/ops/customers';
  redirect(withRedirectedFrom(target, target));
}
