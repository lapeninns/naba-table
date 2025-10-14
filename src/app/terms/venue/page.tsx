import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Venue Booking Policy",
  description: "House rules and cancellation policy for the venue accepting your reservation.",
};

const lastUpdated = "February 05, 2025";

export default function VenueTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wide text-slate-500">Last updated {lastUpdated}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Venue Booking Policy</h1>
        <p className="text-slate-600">
          These house rules apply specifically to reservations at SajiloReserveX Test Kitchen. They sit alongside the
          platform terms and help us deliver a great service for all guests.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Arrival and seating</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-700">
          <li>Please arrive within 10 minutes of your scheduled time. We may release the table after that window.</li>
          <li>Standard dining experiences are allocated 90 minutes; drinks reservations are 75 minutes.</li>
          <li>Let us know about accessibility requirements when booking so we can allocate the best table.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Cancellations</h2>
        <p className="text-slate-700">
          You can cancel or amend your reservation without charge up to 24 hours before the start time. After
          that point please call us on +44&nbsp;20&nbsp;1234&nbsp;5678 so we can try to re-seat or adjust your party.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Dietary requirements</h2>
        <p className="text-slate-700">
          We cater for vegetarian, vegan, and common allergy requirements with at least 24 hours notice.
          Please include details in the booking notes or contact us directly so the kitchen can prepare safely.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Group bookings</h2>
        <p className="text-slate-700">
          Parties larger than 8 guests may need a bespoke menu or deposit. A member of the team will reach out
          using the email or phone number provided to confirm the arrangements.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Contact details</h2>
        <p className="text-slate-700">
          Venue: SajiloReserveX Test Kitchen<br />
          Address: 12 Market Row, London SE1 0AA<br />
          Phone: +44&nbsp;20&nbsp;1234&nbsp;5678<br />
          Email: <a className="underline" href="mailto:reservations@SajiloReserveX.co.uk">reservations@SajiloReserveX.co.uk</a>
        </p>
      </section>
    </main>
  );
}
