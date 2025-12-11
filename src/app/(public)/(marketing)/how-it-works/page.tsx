
import {
  GuestLandingFAQSection,
  GuestLandingHowItWorksSection,
  GuestLandingFinalCTASection,
} from "@/components/marketing/GuestLandingPage";
import { Badge } from "@/components/ui/badge";

import type { Metadata } from "next";

const BRAND_NAME = "Nab a Table";
const PRIMARY_REGION = "Cambridgeshire, Norfolk and Bedfordshire";

export const metadata: Metadata = {
  title: `${BRAND_NAME} · How booking works`,
  description:
    `See how guests discover restaurants across ${PRIMARY_REGION}, pick a time, and confirm their table in a few simple steps with instant, reliable status.`,
};

export default function HowItWorksPage() {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border/40 bg-background py-16">
        <div className="mx-auto flex w-full max-w-[80vw] flex-col gap-4 px-6 text-center md:text-left">
          <Badge className="mx-auto w-fit md:mx-0" variant="secondary">
            How it works
          </Badge>
          <h1 className="text-balance text-3xl font-semibold md:text-4xl">
            From search to seat in four clear steps
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl md:mx-0">
            This page expands on the main guest landing so you can see exactly what happens between choosing a
            restaurant, confirming a time, and arriving at your table.
          </p>
        </div>
      </section>

      <GuestLandingHowItWorksSection />
      <GuestLandingFAQSection />
      <GuestLandingFinalCTASection />
    </div>
  );
}
