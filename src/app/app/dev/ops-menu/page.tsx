import { enforceDevOnly } from '@/app/(public)/dev/_shared/enforceDevOnly';
import { OpsMenuDevHarness } from '@/app/(public)/dev/ops-menu/ui/OpsMenuDevHarness';

export const metadata = {
  title: 'Dev: Ops menu',
};

export default function AppOpsMenuDevPage() {
  enforceDevOnly();
  return <OpsMenuDevHarness />;
}
