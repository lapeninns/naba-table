import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { GuestBookingSundayRoastDevHarness } from './ui/GuestBookingSundayRoastDevHarness';

export const metadata = {
  title: 'Dev: Sunday roast booking',
};

export default function GuestBookingSundayRoastDevPage() {
  enforceDevOnly();

  return <GuestBookingSundayRoastDevHarness />;
}
