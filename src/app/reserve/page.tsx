import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reserve a table · SajiloReserveX",
  description: "Pick a SajiloReserveX partner restaurant and book your next visit in seconds.",
  robots: {
    index: false,
    follow: false,
  },
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ReserveRedirectPage({ 
  searchParams 
}: { 
  searchParams: Promise<SearchParams> 
}) {
  const resolvedParams = await searchParams;
  const params = new URLSearchParams();

  Object.entries(resolvedParams ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined) {
          params.append(key, entry);
        }
      });
      return;
    }

    if (value !== undefined) {
      params.append(key, value);
    }
  });

  const query = params.toString();
  redirect(query ? `/?${query}` : "/");
}
