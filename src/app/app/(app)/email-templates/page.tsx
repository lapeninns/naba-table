import { OpsEmailTemplatesClient } from '@/components/features/email-templates/OpsEmailTemplatesClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email Templates · Nab a Table Ops',
  description: 'Manage and A/B test guest-facing transactional email copy.',
};

export default function OpsEmailTemplatesPage() {
  return <OpsEmailTemplatesClient />;
}
