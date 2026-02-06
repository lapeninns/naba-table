import { OpsRestaurantSettingsDevHarness } from './ui/OpsRestaurantSettingsDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops restaurant settings',
};

export default function OpsRestaurantSettingsDevPage() {
  enforceDevOnly();
  return <OpsRestaurantSettingsDevHarness />;
}

