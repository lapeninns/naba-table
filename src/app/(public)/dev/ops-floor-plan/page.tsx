import { OpsFloorPlanDevHarness } from './ui/OpsFloorPlanDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Floor plan',
};

export default async function OpsFloorPlanDevPage({
  searchParams,
}: {
  searchParams?: Promise<{ scenario?: string; fail?: string }>;
}) {
  enforceDevOnly();
  const params = (await searchParams) ?? {};
  const scenario =
    params.scenario === 'empty' || params.scenario === 'error' ? params.scenario : 'live';
  return <OpsFloorPlanDevHarness scenario={scenario} failNextAssign={params.fail === 'assign'} />;
}
