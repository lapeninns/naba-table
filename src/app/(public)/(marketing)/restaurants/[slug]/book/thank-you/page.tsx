import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ReservationThankYouCard } from '@/components/restaurants/PublicSections';
import { sanitizeRedirect } from '@/lib/auth/redirects';
import { withRedirectedFrom } from '@/lib/url/withRedirectedFrom';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reservation Confirmed · Nab a Table',
  description: 'Your table has been reserved.',
};

type RouteParams = Promise<{ slug: string }>;
type SearchParamValue = string | string[] | undefined;
type SearchParams = Promise<Record<string, SearchParamValue>>;

const buildRestaurantConfirmationPath = (
  slug: string,
  searchParams: Record<string, SearchParamValue>,
): string => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') {
          query.append(key, entry);
        }
      }
      continue;
    }

    query.append(key, value);
  }

  const basePath = `/restaurants/${encodeURIComponent(slug)}/book/thank-you`;
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
};

export default async function ReservationThankYouPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const canonicalPath = buildRestaurantConfirmationPath(slug, resolvedSearchParams);
  const headersList = await headers();
  const hostHeader = headersList.get('host') ?? '';
  const hostname = hostHeader.replace(/:\d+$/, '');
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  const confirmedValue = resolvedSearchParams.confirmation;
  const confirmation =
    typeof confirmedValue === 'string'
      ? confirmedValue
      : Array.isArray(confirmedValue) && typeof confirmedValue[0] === 'string'
        ? confirmedValue[0]
        : null;
  const hasConfirmationState = confirmation?.trim().length;

  const supabase = await getServerComponentSupabaseClient();
  const userResponse = await supabase.auth.getUser();
  const user = userResponse.data.user;
  const validatedTarget = sanitizeRedirect(canonicalPath, rootDomain, hostname);

  if (!user && hasConfirmationState && validatedTarget) {
    redirect(withRedirectedFrom('/auth/signin', validatedTarget));
  }

  return <ReservationThankYouCard />;
}

