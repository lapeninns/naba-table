import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { GuestBookingCapacityDevHarness } from './ui/GuestBookingCapacityDevHarness';

export const metadata = {
  title: 'Dev: Guest booking capacity handling',
};

export default function GuestBookingCapacityDevPage() {
  enforceDevOnly();

  return <GuestBookingCapacityDevHarness />;
}
