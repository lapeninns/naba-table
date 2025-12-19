import { redirect } from "next/navigation";

type Params = Promise<{ bookingId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export default async function ManageBookingRedirect({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { bookingId } = await params;
  const resolvedSearch = await searchParams;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearch ?? {})) {
    if (typeof value === "string") {
      query.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    }
  }

  const search = query.toString();
  const target = `/bookings/${encodeURIComponent(bookingId)}${search ? `?${search}` : ""}`;

  redirect(target);
}
