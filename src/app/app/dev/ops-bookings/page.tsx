import { OpsBookingsDevHarness } from '@/app/(public)/dev/ops-bookings/ui/OpsBookingsDevHarness';

import { enforceDevOnly } from '../../../(public)/dev/_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops bookings (/app mode)',
};

export default function OpsBookingsAppModeDevPage() {
  enforceDevOnly();
  return <OpsBookingsDevHarness />;
}
