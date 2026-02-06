import { OpsBookingDialogDevHarness } from './ui/OpsBookingDialogDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops booking dialog',
};

export default function OpsBookingDialogDevPage() {
  enforceDevOnly();

  return <OpsBookingDialogDevHarness />;
}
