import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

export default function FloorPlanRoute() {
  redirect(opsHref('/settings/restaurant/tables'));
}
