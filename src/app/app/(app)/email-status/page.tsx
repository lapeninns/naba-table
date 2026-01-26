import { OpsEmailStatusClient } from '@/components/features/email-status/OpsEmailStatusClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email status · Nab a Table Ops',
  description: 'Track queued, delayed, and failed booking emails.',
};

export default function OpsEmailStatusPage() {
  return <OpsEmailStatusClient />;
}
