import { enforceDevOnly } from '../_shared/enforceDevOnly';
import { FloorPlanDevHarness } from './ui/FloorPlanDevHarness';

export const metadata = {
  title: 'Dev: Ops floor plan',
};

export default function OpsFloorPlanDevPage() {
  enforceDevOnly();
  return <FloorPlanDevHarness />;
}
