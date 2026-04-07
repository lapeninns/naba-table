import { RestaurantsDirectoryDevHarness } from './ui/RestaurantsDirectoryDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Restaurants directory',
};

export default function RestaurantsDirectoryDevPage() {
  enforceDevOnly();
  return <RestaurantsDirectoryDevHarness />;
}
