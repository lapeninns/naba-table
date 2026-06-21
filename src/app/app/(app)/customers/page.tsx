import { OpsCustomersClient } from '@/components/features/customers/OpsCustomersClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guests · Nab a Table Ops',
  description: 'View and export guest booking history for your restaurant.',
};

export default async function OpsCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawFocus = resolvedSearchParams.focus;
  const focusCustomer = (Array.isArray(rawFocus) ? rawFocus[0] : rawFocus)?.trim() || null;

  return <OpsCustomersClient focusCustomer={focusCustomer} />;
}
