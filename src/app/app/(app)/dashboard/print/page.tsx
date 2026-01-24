import { OpsBookingsPrintView } from '@/components/features/dashboard/OpsBookingsPrintView';

type PrintPageSearchParams = {
  date?: string | string[];
  filter?: string | string[];
  search?: string | string[];
  sortKey?: string | string[];
  sortDir?: string | string[];
};

export default async function OpsDashboardPrintPage({
  searchParams,
}: {
  searchParams?: Promise<PrintPageSearchParams>;
}) {
  const resolvedParams = (await searchParams) ?? {};
  return <OpsBookingsPrintView params={resolvedParams} />;
}
