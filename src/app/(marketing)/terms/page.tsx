import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Terms of Service · SajiloReserveX",
  description: "Understand the terms that govern your use of SajiloReserveX guest services.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16 sm:px-8 lg:px-10">
      <header className="space-y-3 text-left">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Legal</p>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Terms of Service</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          These terms apply when you browse, book, or manage reservations on SajiloReserveX as a guest user.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/privacy-policy" className={cn(buttonVariants({ variant: "outline" }), "touch-manipulation")}>Read Privacy Policy</Link>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "touch-manipulation text-primary")}>Return home</Link>
        </div>
      </header>

      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title="Using SajiloReserveX">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>You must provide accurate contact details to create or manage bookings.</li>
            <li>Reservations may be subject to restaurant-specific policies (e.g., deposits or cancellation windows).</li>
            <li>Do not misuse the service (fraud, scraping, unauthorized access).</li>
          </ul>
        </Section>

        <Section title="Bookings and changes">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Restaurant partners may accept, modify, or cancel bookings per their policies.</li>
            <li>We relay confirmations, changes, or cancellations to your provided contact details.</li>
            <li>Use the &quot;My bookings&quot; area or support to request changes when available.</li>
          </ul>
        </Section>

        <Section title="Liability">
          <p className="text-sm text-slate-700"><span>SajiloReserveX provides booking coordination; restaurants deliver the dining service. To the maximum extent permitted by law, we are not liable for indirect or consequential damages. Your statutory consumer rights remain unaffected where applicable.</span></p>
        </Section>

        <Section title="Termination">
          <p className="text-sm text-slate-700">
            We may suspend or terminate access for misuse, fraud, or legal compliance. You may stop using the service at any time; requests
            to delete your account or data can be made via support.
          </p>
        </Section>

        <Section title="Updates">
          <p className="text-sm text-slate-700">
            We may update these terms to reflect product or legal changes. Continued use after updates constitutes acceptance; material changes
            will be communicated where required.
          </p>
        </Section>

        <Section title="Contact">
          <p className="text-sm text-slate-700">
            Questions about these terms: <a className="text-primary underline" href="mailto:support@sajiloreservex.com">support@sajiloreservex.com</a>
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
