import { Database, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';

import {
  GuestContent,
  GuestDetailList,
  GuestHero,
  GuestMetricCard,
  GuestPageFrame,
  GuestPanel,
  GuestSectionHeader,
} from '@/components/guest/ui';
import appConfig from '@/config/app.config';

import type { Metadata } from 'next';

const EFFECTIVE_DATE = 'January 29, 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy · Nab a Table',
  description:
    'Learn how Nab a Table collects, uses, and protects your information when you book and manage reservations.',
};

const sections = [
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    body: 'We collect information that helps us provide reservations and keep venues informed.',
    bullets: [
      'Contact details you submit, such as name, email address, and phone number when creating or managing bookings.',
      'Reservation details like party size, date, time, occasion notes, and dining preferences.',
      'Account and authentication information if you create an account or sign in using magic links.',
      'Usage data about how you interact with our site, such as pages viewed and device information.',
      'Communications with support or restaurants, including feedback and requests.',
    ],
  },
  {
    id: 'how-we-use',
    title: 'How we use information',
    bullets: [
      'Confirm reservations and send updates about your booking.',
      'Share reservation details with the restaurant so they can prepare for your visit.',
      'Provide account features like saved preferences and booking history.',
      'Improve product performance, reliability, and guest experience.',
      'Protect against fraud, misuse, and unauthorized access.',
      'Comply with legal obligations where required.',
    ],
  },
  {
    id: 'sharing',
    title: 'How we share information',
    body: 'We share information only when needed to deliver our services.',
    bullets: [
      'Restaurants receive reservation details and contact information to fulfill bookings.',
      'Service providers may process data on our behalf for hosting, analytics, or support tools.',
      'We may disclose information to comply with law, protect users, or enforce terms.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies and analytics',
    body: 'We use cookies and similar technologies to keep you signed in, remember preferences, and understand site performance. You can manage cookies in your browser settings. Some features may not work if cookies are disabled.',
  },
  {
    id: 'retention',
    title: 'Data retention',
    body: 'We keep information only as long as needed for bookings, legal requirements, and legitimate business purposes. When data is no longer required, we delete or anonymize it.',
  },
  {
    id: 'your-rights',
    title: 'Your choices and rights',
    bullets: [
      'Access or update your account information from your profile.',
      'Request a copy or deletion of your data by contacting support.',
      'Opt out of marketing communications using the unsubscribe links provided.',
    ],
  },
  {
    id: 'security',
    title: 'Security',
    body: 'We use administrative, technical, and physical safeguards to protect your information. No system is fully secure, so please contact us if you suspect unauthorized access.',
  },
  {
    id: 'updates',
    title: 'Policy updates',
    body: 'We may update this policy from time to time. We will revise the effective date above and may notify you of significant changes.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <GuestPageFrame>
      <GuestHero
        eyebrow="Privacy policy"
        title="Clear rules for guest reservation data."
        description="Nab a Table helps guests book and manage tables. This page explains what we collect, why we use it, and how to contact us."
        aside={
          <div className="grid grid-cols-2 gap-3">
            <GuestMetricCard icon={ShieldCheck} label="Use" value="Bookings" />
            <GuestMetricCard icon={LockKeyhole} label="Access" value="Secure" />
            <GuestMetricCard icon={Database} label="Retention" value="Limited" />
            <GuestMetricCard icon={UserRound} label="Control" value="Guest" />
          </div>
        }
        compact
      />

      <GuestContent>
        <div className="grid gap-6 lg:grid-cols-[4fr_8fr]">
          <div className="space-y-6">
            <GuestDetailList
              title="Policy summary"
              items={[
                { icon: ShieldCheck, label: 'Effective date', value: EFFECTIVE_DATE },
                {
                  icon: Mail,
                  label: 'Contact',
                  value: (
                    <a className="text-primary underline underline-offset-4" href={`mailto:${appConfig.email.supportEmail}`}>
                      {appConfig.email.supportEmail}
                    </a>
                  ),
                },
              ]}
            />
            <GuestPanel className="sticky top-24 hidden p-5 lg:block">
              <p className="text-sm font-semibold text-foreground">Sections</p>
              <nav aria-label="Privacy policy sections" className="mt-3 grid gap-2 text-sm">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    className="rounded-full px-3 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    href={`#${section.id}`}
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </GuestPanel>
          </div>

          <div className="space-y-6">
            <GuestSectionHeader
              eyebrow="Details"
              title="The full policy"
              description="Written for guests who book tables, manage reservations, or contact support through Nab a Table."
            />
            {sections.map((section) => (
              <GuestPanel key={section.id} id={section.id} className="scroll-mt-28 p-5 sm:p-6">
                <h2 className="pg-card-title">{section.title}</h2>
                {section.body ? <p className="pg-body mt-3">{section.body}</p> : null}
                {section.bullets ? (
                  <ul className="pg-body mt-4 list-disc space-y-2 pl-5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </GuestPanel>
            ))}
          </div>
        </div>
      </GuestContent>
    </GuestPageFrame>
  );
}
