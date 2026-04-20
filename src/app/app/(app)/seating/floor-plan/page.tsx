import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

export default function SeatingFloorPlanPage() {
  redirect(opsHref('/settings/restaurant/tables'));
}
