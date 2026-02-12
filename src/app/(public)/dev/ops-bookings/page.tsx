import { OpsBookingsDevHarness } from './ui/OpsBookingsDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops bookings',
};

export default function OpsBookingsDevPage() {
  enforceDevOnly();
  return <OpsBookingsDevHarness />;
}

