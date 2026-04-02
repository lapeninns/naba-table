import { OpsEmailTemplatesDevHarness } from './ui/OpsEmailTemplatesDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops email templates',
};

export default function OpsEmailTemplatesDevPage() {
  enforceDevOnly();
  return <OpsEmailTemplatesDevHarness />;
}
