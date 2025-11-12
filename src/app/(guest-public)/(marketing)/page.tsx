import type { Metadata } from "next";

import { OwnerLandingPage } from "@/components/owner-marketing/OwnerLandingPage";
import config from "@/config";

export const metadata: Metadata = {
  title: `${config.appName} · Restaurant console for owners`,
  description:
    "Turn your website into a high-converting booking engine with SajiloReserveX. Give hosts, sommeliers, and managers one console for pacing, messaging, and automation.",
  openGraph: {
    title: `${config.appName} · Restaurant console for owners`,
    description:
      "Give your team the operations console built for restaurants, not marketplaces.",
    type: "website",
  },
};

export default function HomePage() {
  return <OwnerLandingPage />;
}
