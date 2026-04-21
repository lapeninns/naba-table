import { OpsSmsDeliveryDevHarness } from './ui/OpsSmsDeliveryDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops SMS delivery',
};

export default function OpsSmsDeliveryDevPage() {
  enforceDevOnly();
  return <OpsSmsDeliveryDevHarness />;
}
