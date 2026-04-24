import { GuestLayout } from '@/components/layouts/GuestLayout';

import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { GuestDashboardDevHarness } from './ui/GuestDashboardDevHarness';

export const metadata = {
  title: 'Dev: Guest dashboard',
};

export default function GuestDashboardDevPage() {
  enforceDevOnly();

  return (
    <GuestLayout>
      <GuestDashboardDevHarness />
    </GuestLayout>
  );
}
