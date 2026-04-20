import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

export default function BookingOccasionsSettingsPage() {
  redirect(opsHref('/settings/restaurant/availability#booking-occasions'));
}
