import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { GuestBookingErrorDevHarness } from './ui/GuestBookingErrorDevHarness';

export const metadata = {
  title: 'Dev: Guest booking error copy',
};

export default function GuestBookingErrorDevPage() {
  enforceDevOnly();

  return <GuestBookingErrorDevHarness />;
}
