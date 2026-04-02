import { OpsNavigationDevHarness } from '@/app/(public)/dev/ops-navigation/ui/OpsNavigationDevHarness';

import { enforceDevOnly } from '../../../(public)/dev/_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops navigation (/app mode)',
};

export default function OpsNavigationAppModeDevPage() {
  enforceDevOnly();
  return <OpsNavigationDevHarness />;
}
