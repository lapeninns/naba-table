import { OpsEmailDeliveryDevHarness } from './ui/OpsEmailDeliveryDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops email delivery',
};

export default function OpsEmailDeliveryDevPage() {
  enforceDevOnly();
  return <OpsEmailDeliveryDevHarness />;
}

