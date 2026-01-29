import appConfig from '@/config/app.config';

import type { Metadata } from 'next';


const EFFECTIVE_DATE = 'January 29, 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy · Nab a Table',
  description:
    'Learn how Nab a Table collects, uses, and protects your information when you book and manage reservations.',
};

export default function PrivacyPolicyPage() {
  return (
    <article className="guest-page space-y-10">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Privacy Policy
        </p>
        <h1 className="heading-page">Privacy Policy</h1>
        <p className="text-body-warm max-w-3xl">
          Nab a Table helps diners discover restaurants and confirm reservations. This policy explains what
          information we collect, why we use it, and the choices you have.
        </p>
        <div className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>
          <p className="text-sm text-muted-foreground">
            Questions? Contact us at{' '}
            <a
              className="font-semibold text-foreground underline underline-offset-4"
              href={`mailto:${appConfig.email.supportEmail}`}
            >
              {appConfig.email.supportEmail}
            </a>
            .
          </p>
        </div>
      </header>

      <nav aria-label="Privacy policy sections" className="rounded-2xl border border-border bg-surface-elevated p-5">
        <p className="text-sm font-semibold text-foreground">Sections</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <a className="underline underline-offset-4" href="#information-we-collect">
              Information we collect
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="#how-we-use">
              How we use information
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="#sharing">
              How we share information
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="#cookies">
              Cookies and analytics
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="#retention">
              Data retention
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="#your-rights">
              Your choices and rights
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="#security">
              Security
            </a>
          </li>
          <li>
            <a className="underline underline-offset-4" href="#updates">
              Policy updates
            </a>
          </li>
        </ul>
      </nav>

      <section id="information-we-collect" className="space-y-4">
        <h2 className="heading-section">Information we collect</h2>
        <p className="text-body-warm max-w-3xl">
          We collect information that helps us provide reservations and keep venues informed.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-body-warm">
          <li>
            Contact details you submit, such as name, email address, and phone number when creating or
            managing bookings.
          </li>
          <li>
            Reservation details like party size, date, time, occasion notes, and dining preferences.
          </li>
          <li>
            Account and authentication information if you create an account or sign in using magic links.
          </li>
          <li>
            Usage data about how you interact with our site, such as pages viewed and device information.
          </li>
          <li>
            Communications with support or restaurants, including feedback and requests.
          </li>
        </ul>
      </section>

      <section id="how-we-use" className="space-y-4">
        <h2 className="heading-section">How we use information</h2>
        <ul className="list-disc space-y-2 pl-5 text-body-warm">
          <li>Confirm reservations and send updates about your booking.</li>
          <li>Share reservation details with the restaurant so they can prepare for your visit.</li>
          <li>Provide account features like saved preferences and booking history.</li>
          <li>Improve product performance, reliability, and guest experience.</li>
          <li>Protect against fraud, misuse, and unauthorized access.</li>
          <li>Comply with legal obligations where required.</li>
        </ul>
      </section>

      <section id="sharing" className="space-y-4">
        <h2 className="heading-section">How we share information</h2>
        <p className="text-body-warm max-w-3xl">
          We share information only when needed to deliver our services.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-body-warm">
          <li>Restaurants receive reservation details and contact information to fulfill bookings.</li>
          <li>Service providers may process data on our behalf for hosting, analytics, or support tools.</li>
          <li>We may disclose information to comply with law, protect users, or enforce terms.</li>
        </ul>
      </section>

      <section id="cookies" className="space-y-4">
        <h2 className="heading-section">Cookies and analytics</h2>
        <p className="text-body-warm max-w-3xl">
          We use cookies and similar technologies to keep you signed in, remember preferences, and understand
          site performance. You can manage cookies in your browser settings. Some features may not work if
          cookies are disabled.
        </p>
      </section>

      <section id="retention" className="space-y-4">
        <h2 className="heading-section">Data retention</h2>
        <p className="text-body-warm max-w-3xl">
          We keep information only as long as needed for bookings, legal requirements, and legitimate business
          purposes. When data is no longer required, we delete or anonymize it.
        </p>
      </section>

      <section id="your-rights" className="space-y-4">
        <h2 className="heading-section">Your choices and rights</h2>
        <ul className="list-disc space-y-2 pl-5 text-body-warm">
          <li>Access or update your account information from your profile.</li>
          <li>Request a copy or deletion of your data by contacting support.</li>
          <li>Opt out of marketing communications using the unsubscribe links provided.</li>
        </ul>
      </section>

      <section id="security" className="space-y-4">
        <h2 className="heading-section">Security</h2>
        <p className="text-body-warm max-w-3xl">
          We use administrative, technical, and physical safeguards to protect your information. No system is
          fully secure, so please contact us if you suspect unauthorized access.
        </p>
      </section>

      <section id="updates" className="space-y-4">
        <h2 className="heading-section">Policy updates</h2>
        <p className="text-body-warm max-w-3xl">
          We may update this policy from time to time. We will revise the effective date above and may notify
          you of significant changes.
        </p>
      </section>
    </article>
  );
}
