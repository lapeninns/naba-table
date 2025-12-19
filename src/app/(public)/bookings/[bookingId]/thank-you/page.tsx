import { redirect } from "next/navigation";

type Params = Promise<{ bookingId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export default async function LegacyBookingThankYouRedirect({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { bookingId } = await params;
  const resolvedSearch = await searchParams;

  // Build query string preserving token if present
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearch ?? {})) {
    if (typeof value === "string") {
      query.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    }
  }

  const search = query.toString();
  const target = `/guest/bookings/${encodeURIComponent(bookingId)}/receipt${search ? `?${search}` : ""}`;

  // 308 Permanent Redirect to canonical receipt
  redirect(target);
}
