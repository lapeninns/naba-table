import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Privacy Policy · SajiloReserveX",
  description: "Learn how SajiloReserveX collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16 sm:px-8 lg:px-10">
      <header className="space-y-3 text-left">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Legal</p>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Privacy Policy</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          We explain what we collect, why we collect it, and how you can manage your information.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/terms" className={cn(buttonVariants({ variant: "outline" }), "touch-manipulation")}>Read Terms of Service</Link>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "touch-manipulation text-primary")}>Return home</Link>
        </div>
      </header>

      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title="Information we collect">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Contact details you provide (name, email, phone) to make or manage bookings.</li>
            <li>Booking details (restaurant, time, party size, notes) needed to confirm reservations.</li>
            <li>Technical data from app usage (device, browser, approximate location) for security and reliability.</li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>To create, update, and notify you about reservations.</li>
            <li>To support customer requests and prevent fraud or abuse.</li>
            <li>To improve product performance and usability.</li>
          </ul>
        </Section>

        <Section title="Sharing">
          <p className="text-sm text-slate-700">
            We share booking details with participating restaurants to fulfill your reservation. We do not sell personal data. Third-party
            providers (e.g., email, analytics) process data under contract and only as needed to deliver the service.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Access, update, or delete your contact details in your account profile.</li>
            <li>Request data export or deletion by contacting support.</li>
            <li>Opt out of non-essential communications where offered.</li>
          </ul>
        </Section>

        <Section title="Security">
          <p className="text-sm text-slate-700">
            We use encryption in transit and apply access controls to protect data. No system is perfect—reach support if you suspect
            unauthorized activity.
          </p>
        </Section>

        <Section title="Contact">
          <p className="text-sm text-slate-700">
            Questions or requests: <a className="text-primary underline" href="mailto:support@sajiloreservex.com">support@sajiloreservex.com</a>
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
