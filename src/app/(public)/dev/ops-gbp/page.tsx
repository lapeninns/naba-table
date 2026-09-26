import { OpsGbpDevHarness } from './ui/OpsGbpDevHarness';
import { isGbpScenario } from '../_mocks/gbp/gbpFixtures';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Google Business Profile',
};

export default async function OpsGbpDevPage({
  searchParams,
}: {
  searchParams?: Promise<{ scenario?: string }>;
}) {
  enforceDevOnly();
  const params = (await searchParams) ?? {};
  return (
    <OpsGbpDevHarness scenario={isGbpScenario(params.scenario) ? params.scenario : 'linked'} />
  );
}
