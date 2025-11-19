import { redirect } from 'next/navigation';

import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';

export default async function OpsCustomerProfileRedirect({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const target = `/customers?focus=${encodeURIComponent(customerId)}`;
  redirect(withRedirectedFrom(target, target));
}
