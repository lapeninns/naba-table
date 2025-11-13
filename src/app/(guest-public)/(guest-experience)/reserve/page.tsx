import ReserveApp from "./_components/ReserveApp";

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

export default function ReserveEntryPage() {
  return <ReserveApp initialPath="/" />;
}
