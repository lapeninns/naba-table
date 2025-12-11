
import { GuestLandingFinalCTASection } from "@/components/marketing/GuestLandingPage";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Metadata } from "next";

const BRAND_NAME = "Nab a Table";
const PRIMARY_REGION = "Cambridgeshire, Norfolk and Bedfordshire";

export const metadata: Metadata = {
  title: `${BRAND_NAME} · Trust & safety`,
  description:
    `Why guests can trust that what they see when booking across ${PRIMARY_REGION} matches their confirmation, receipt, and in-venue experience.`,
};

export default function TrustAndSafetyPage() {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border/40 bg-background py-16">
        <div className="mx-auto flex w-full max-w-[80vw] flex-col gap-4 px-6 text-center md:text-left">
          <Badge className="mx-auto w-fit md:mx-0" variant="secondary">
            Trust &amp; safety
          </Badge>
          <h1 className="text-balance text-3xl font-semibold md:text-4xl">
            Why guests can rely on their bookings
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl md:mx-0">
            Nab a Table is designed so that your confirmation, receipt, and on-the-day experience all match what you
            saw when you booked.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto flex w-full max-w-[80vw] flex-col gap-8 px-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold md:text-3xl">No surprises from search to receipt</h2>
            <p className="text-muted-foreground max-w-3xl">
              We keep the booking surface, confirmation page, and receipt in sync so there are no hidden fees, timing
              changes, or unexpected rules that appear after you&apos;ve booked.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Clear before-and-after views</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Key details like date, time, party size, and hold window match across search, confirmation, and receipt.</p>
                <p>You can always reopen your booking via /guest/bookings or your email link to double-check the details.</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Accessible by design</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Pages follow keyboard and screen-reader best practices, so you can navigate booking and receipt views
                  without relying on a mouse.
                </p>
                <p>Color is never the only way we communicate status; we pair it with clear labels and icons.</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Secure share links</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Shareable links use the same protections as the guest portal; you can share a receipt without exposing
                  your full account.
                </p>
                <p>We avoid putting sensitive data directly into URLs and follow the repo&apos;s secret-handling rules.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <GuestLandingFinalCTASection />
    </div>
  );
}
