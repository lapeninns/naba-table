import { redirect } from "next/navigation";

type Params = Promise<{ slug: string; bookingId: string }>;
type SearchParamValue = string | string[] | undefined;
type SearchParams = Promise<Record<string, SearchParamValue>>;

export const dynamic = "force-dynamic";

const buildCanonicalRestaurantBookingThankYouPath = (
  slug: string,
  searchParams: Record<string, SearchParamValue>,
): string => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
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

export default async function RestaurantBookingThankYouRedirect({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  redirect(buildCanonicalRestaurantBookingThankYouPath(slug, resolvedSearchParams));
}
