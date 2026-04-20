import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team management · Nab a Table',
  description: 'This route has moved to restaurant settings.',
};

export default function TeamManagementPage() {
  redirect(opsHref('/settings/restaurant/team'));
}
