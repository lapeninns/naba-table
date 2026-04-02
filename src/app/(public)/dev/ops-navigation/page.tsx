import { OpsNavigationDevHarness } from './ui/OpsNavigationDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops navigation',
};

export default function OpsNavigationDevPage() {
  enforceDevOnly();
  return <OpsNavigationDevHarness />;
}
