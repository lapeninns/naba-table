import { OpsFloorPlanDevHarness } from './ui/OpsFloorPlanDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops floor plan',
};

export default function OpsFloorPlanDevPage() {
  enforceDevOnly();
  return <OpsFloorPlanDevHarness />;
}

