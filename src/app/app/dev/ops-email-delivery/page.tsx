import { OpsEmailDeliveryDevHarness } from '@/app/(public)/dev/ops-email-delivery/ui/OpsEmailDeliveryDevHarness';

import { enforceDevOnly } from '../../../(public)/dev/_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops email delivery (/app mode)',
};

export default function OpsEmailDeliveryAppModeDevPage() {
  enforceDevOnly();
  return <OpsEmailDeliveryDevHarness />;
}

