import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

export default function ServicePeriodsSettingsPage() {
  redirect(opsHref('/settings/restaurant/availability#service-periods'));
}
