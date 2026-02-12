import { OpsDashboardDevHarness } from './ui/OpsDashboardDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops dashboard',
};

export default function OpsDashboardDevPage() {
  enforceDevOnly();
  return <OpsDashboardDevHarness />;
}

