import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

export default function OperatingHoursSettingsPage() {
  redirect(opsHref('/settings/restaurant/availability#availability-hours'));
}
