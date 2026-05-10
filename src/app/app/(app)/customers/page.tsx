import { OpsCustomersClient } from '@/components/features/customers/OpsCustomersClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guests · Nab a Table Ops',
  description: 'View and export guest booking history for your restaurant.',
};

export default async function OpsCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const focusCustomer = resolvedSearchParams.focus ?? null;

  return <OpsCustomersClient focusCustomer={focusCustomer} />;
}
