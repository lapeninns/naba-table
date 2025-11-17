import { redirect } from 'next/navigation';

import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';

export default async function LegacyRestaurantSettingsRedirect() {
  const target = '/ops/settings/restaurant';
  redirect(withRedirectedFrom(target, target));
}
