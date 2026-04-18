import { OpsMenuDevHarness } from './ui/OpsMenuDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops menu',
};

export default function OpsMenuDevPage() {
  enforceDevOnly();
  return <OpsMenuDevHarness />;
}
