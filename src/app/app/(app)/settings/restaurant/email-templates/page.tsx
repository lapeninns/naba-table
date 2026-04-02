import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email Templates · Nab a Table Ops',
  description: 'This route has moved to the standalone email templates command center.',
};

export default function RestaurantEmailTemplatesSettingsPage() {
  redirect('/app/email-templates');
}
