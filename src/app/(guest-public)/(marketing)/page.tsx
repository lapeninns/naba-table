
import { OwnerLandingPage } from "@/components/owner-marketing/OwnerLandingPage";
import config from "@/config";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `${config.appName} · Restaurant console for owners`,
  description:
    "Capture guest bookings online and manage every reservation, table assignment, and customer detail from one console.",
  openGraph: {
    title: `${config.appName} · Restaurant console for owners`,
    description:
      "Self-serve guest booking, confirmation emails, and the operations dashboard for table assignments and walk-ins.",
    type: "website",
  },
};

export default function HomePage() {
  return <OwnerLandingPage />;
}
