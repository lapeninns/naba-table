import { OpsBookingsListDevHarness } from './ui/OpsBookingsListDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops bookings list',
};

export default function OpsBookingsListDevPage() {
  enforceDevOnly();

  return <OpsBookingsListDevHarness />;
}
