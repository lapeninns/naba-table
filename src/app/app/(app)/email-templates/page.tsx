import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email Templates · Nab a Table Ops',
  description: 'Email templates now live in restaurant settings.',
};

export default function OpsEmailTemplatesPage() {
  redirect('/app/settings/restaurant/email-templates');
}
