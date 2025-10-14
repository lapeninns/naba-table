import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SajiloReserveX Terms of Service",
  description: "Terms of service for guests using SajiloReserveX to reserve a table.",
};

const lastUpdated = "February 05, 2025";

export default function SajiloReserveXTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wide text-slate-500">Last updated {lastUpdated}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">SajiloReserveX Terms of Service</h1>
        <p className="text-slate-600">
          These terms explain how SajiloReserveX provides reservation services to diners. By submitting a booking
          request you confirm that you have read, understood, and agree to the conditions below.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">1. Who we are</h2>
        <p className="text-slate-700">
          SajiloReserveX is a reservation platform operated by SajiloReserveX Ltd. We partner with restaurants to
          capture booking requests, share confirmations, and send service messages such as amendments or
          cancellations. The dining experience itself is delivered by the venue you select.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">2. Making a reservation</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-700">
          <li>You must supply accurate guest contact details so the venue can reach you if plans change.</li>
          <li>Reservations are not transferable; only the named guest (or their party) may redeem the table.</li>
          <li>Some venues may request a card guarantee or deposit. If required you will be directed to complete it securely with the venue.</li>
          <li>We reserve the right to decline or cancel bookings that breach venue policies or if fraud is suspected.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">3. Changes and cancellations</h2>
        <p className="text-slate-700">
          Each venue sets its own cancellation window. SajiloReserveX gives you links to manage your booking online;
          if you are inside the cutoff please contact the venue directly using the details provided in the
          confirmation email. No-shows or late cancellations may result in fees or impact future booking
          privileges.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">4. Guest responsibilities</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-700">
          <li>Arrive on time with your full party so the venue can seat you promptly.</li>
          <li>Inform the venue of allergies or accessibility needs in advance using the notes field or by calling.</li>
          <li>Respect the venue&apos;s house rules and time limits that may apply to the table.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">5. Marketing preferences</h2>
        <p className="text-slate-700">
          If you opt in to marketing, SajiloReserveX will send occasional news and offers on behalf of participating
          venues. You can update your preferences at any time via the My Bookings area or the unsubscribe
          link in every email.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">6. Privacy</h2>
        <p className="text-slate-700">
          Reservation information is shared only with the venue you book. We process personal data in line
          with our <Link href="/privacy-policy" className="underline">Privacy Policy</Link>. The venue is the data
          controller for any information it collects directly from you.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">7. Contact</h2>
        <p className="text-slate-700">
          Need help with a reservation? Email <a className="underline" href="mailto:reservations@SajiloReserveX.co.uk">reservations@SajiloReserveX.co.uk</a>
          or speak with the venue using the contact details in your confirmation email.
        </p>
      </section>
    </main>
  );
}
