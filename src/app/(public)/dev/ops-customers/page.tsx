import { OpsCustomersDevHarness } from './ui/OpsCustomersDevHarness';
import { enforceDevOnly } from '../_shared/enforceDevOnly';

export const metadata = {
  title: 'Dev: Ops customers',
};

export default async function OpsCustomersDevPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  enforceDevOnly();
  const resolvedSearchParams = (await searchParams) ?? {};
  const focusCustomer = resolvedSearchParams.focus ?? null;
  return <OpsCustomersDevHarness focusCustomer={focusCustomer} />;
}
