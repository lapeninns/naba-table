import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy · Nab a Table',
  description: 'How Nab a Table collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">Last updated: January 29, 2026</p>
        <p className="text-sm text-muted-foreground sm:text-base">
          This policy explains how Nab a Table collects, uses, and protects your information when you browse
          restaurants or manage bookings.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Information we collect</h2>
        <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
          <li>
            Account details you provide (name, email address, phone number) when creating an account or confirming
            a reservation.
          </li>
          <li>
            Reservation details such as party size, date, time, preferences, and any notes you submit.
          </li>
          <li>
            Usage data like device type, browser, pages viewed, and approximate location derived from IP address.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">How we use your information</h2>
        <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
          <li>Provide and manage bookings, confirmations, and guest communications.</li>
          <li>Improve our product, measure performance, and diagnose technical issues.</li>
          <li>Protect against fraud, abuse, and unauthorized access.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Sharing and disclosure</h2>
        <ul className="space-y-2 text-sm text-muted-foreground sm:text-base">
          <li>We share booking details with the restaurant you select to fulfill your reservation.</li>
          <li>
            We use trusted service providers for hosting, email delivery, analytics, and support. They only process
            data to provide services on our behalf.
          </li>
          <li>We may disclose information if required by law or to protect the security of our platform.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Cookies and analytics</h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          We use essential cookies to keep you signed in and remember preferences. We also use privacy-focused
          analytics to understand product usage and improve performance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Data retention</h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          We retain account and reservation data for as long as your account is active or as needed to provide our
          services. You can request deletion of your data by contacting us.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Your choices</h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          You can access, update, or delete your account information by signing in and managing your profile. If you
          need help, please reach out via our contact page.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Contact</h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          For privacy questions or requests, use the contact form at{' '}
          <Link className="underline" href="/contact">
            /contact
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
