import { OpsTablesSettingsDevHarness } from './ui/OpsTablesSettingsDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops tables settings',
};

export default function OpsTablesSettingsDevPage() {
  enforceDevOnly();
  return <OpsTablesSettingsDevHarness />;
}

