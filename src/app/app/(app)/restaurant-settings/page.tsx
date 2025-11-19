import { redirect } from 'next/navigation';

import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';

export default async function LegacyRestaurantSettingsRedirect() {
  const target = '/profile';
  redirect(withRedirectedFrom(target, target));
}
