import { OpsNewBookingDevHarness } from './ui/OpsNewBookingDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops new booking',
};

export default function OpsNewBookingDevPage() {
  enforceDevOnly();
  return <OpsNewBookingDevHarness />;
}

