import { redirect } from 'next/navigation';

import { opsHref } from '@/lib/url/opsHref';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email Templates · Nab a Table Ops',
  description: 'This route has moved to the standalone email templates command center.',
};

export default function RestaurantEmailTemplatesSettingsPage() {
  redirect(opsHref('/email-templates'));
}
