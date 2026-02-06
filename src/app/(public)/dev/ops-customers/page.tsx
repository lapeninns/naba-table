import { OpsCustomersDevHarness } from './ui/OpsCustomersDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops customers',
};

export default function OpsCustomersDevPage() {
  enforceDevOnly();
  return <OpsCustomersDevHarness />;
}

