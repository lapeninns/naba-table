import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { GuestBookingPlanAlertDevHarness } from './ui/GuestBookingPlanAlertDevHarness';

export const metadata = {
  title: 'Dev: Guest booking plan alert',
};

export default function GuestBookingPlanAlertDevPage() {
  enforceDevOnly();

  return <GuestBookingPlanAlertDevHarness />;
}
