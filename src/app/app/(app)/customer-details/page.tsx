import { redirect } from 'next/navigation';

import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';

export default async function LegacyCustomerDetailsRedirect() {
  const target = '/customers';
  redirect(withRedirectedFrom(target, target));
}
