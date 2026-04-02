import { OpsEmailTemplatesDevHarness } from '@/app/(public)/dev/ops-email-templates/ui/OpsEmailTemplatesDevHarness';

import { enforceDevOnly } from '../../../(public)/dev/_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops email templates (/app mode)',
};

export default function OpsEmailTemplatesAppModeDevPage() {
  enforceDevOnly();
  return <OpsEmailTemplatesDevHarness />;
}
