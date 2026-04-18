import { OpsMenuManagementClient } from '@/components/features/menu';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Menu · Nab a Table Ops',
  description: 'Manage food and drink menu items, modifiers, and CSV imports for the active restaurant.',
};

export default function RestaurantMenuSettingsPage() {
  return <OpsMenuManagementClient />;
}
