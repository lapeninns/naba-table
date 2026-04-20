import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tables · Nab a Table Ops',
  description: 'This route has moved to restaurant settings.',
};

export default function TablesLegacyRedirectPage() {
  redirect(opsHref('/settings/restaurant/tables'));
}
