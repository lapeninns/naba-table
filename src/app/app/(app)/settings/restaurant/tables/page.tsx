import { Suspense } from 'react';

import TableInventoryClient from '@/components/features/tables/TableInventoryClient';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tables · Nab a Table Ops',
  description: 'Configure seating resources, capacity assumptions, and service zones for your restaurant.',
};

export default function RestaurantTablesSettingsPage() {
  return (
    <Suspense
      fallback={<div className="flex items-center justify-center p-12 text-sm text-muted-foreground">Loading tables…</div>}
    >
      <TableInventoryClient />
    </Suspense>
  );
}
