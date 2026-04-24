import { GuestLayout } from '@/components/layouts/GuestLayout';

import { GuestBookingsDevHarness } from './ui/GuestBookingsDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Guest bookings',
};

export default function GuestBookingsDevPage() {
  enforceDevOnly();

  return (
    <GuestLayout>
      <GuestBookingsDevHarness />
    </GuestLayout>
  );
}
