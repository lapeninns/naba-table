import { redirect } from "next/navigation";

import { InfoCard } from "@/components/guest-account/InfoCard";
import { HeaderActions, PageShell } from "@/components/guest-account/PageShell";
import { ProfileManageForm } from "@/components/profile/ProfileManageForm";
import config from "@/config";
import { getOrCreateProfile } from "@/lib/profile/server";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage profile · SajiloReserveX",
  description:
    "Review and update your SajiloReserveX profile details, including your display name and avatar.",
};

export default async function ProfileManagePage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[profile/manage] auth resolution failed", authError.message);
  }

  if (!user) {
    const loginUrl = config.auth.loginUrl ?? "/signin";
    redirect(withRedirectedFrom(loginUrl, "/profile/manage"));
  }

  const profile = await getOrCreateProfile(supabase, user);
  const supportEmail = config.email?.supportEmail ?? "support@example.com";

  return (
    <PageShell
      eyebrow="Your account"
      title="Manage profile"
      description="Keep your details current so invites, reminders, and updates reach you quickly."
      actions={
        <HeaderActions
          primary={{ href: '/my-bookings', label: 'Back to bookings', variant: 'outline' }}
          secondary={{ href: '/', label: 'New booking', variant: 'default' }}
        />
      }
      maxWidthClassName="max-w-5xl"
    >
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <ProfileManageForm initialProfile={profile} />
        </div>
        <div className="space-y-4">
          <InfoCard
            title="Tips for smoother bookings"
            description="Save changes to keep your reservations accurate."
          >
            <ul className="list-disc space-y-2 pl-5">
              <li>Use the same email you share with restaurants and support.</li>
              <li>Add a phone number so teams can reach you on the day.</li>
              <li>Keep your display name clear for quick check-in.</li>
            </ul>
          </InfoCard>
          <InfoCard
            title="Security & recovery"
            description="Protect your account and recover access quickly."
            footer={
              <div className="text-sm text-slate-700">
                For help updating your email or resetting access, contact
                {' '}
                <a
                  href={`mailto:${supportEmail}`}
                  className="font-medium text-primary underline decoration-primary/60 underline-offset-4"
                >
                  {supportEmail}
                </a>
                .
              </div>
            }
          >
            <ul className="list-disc space-y-2 pl-5">
              <li>Sign out on shared devices when you’re done.</li>
              <li>Use a strong password; reset from the sign-in page when needed.</li>
              <li>Check your inbox for booking updates and confirmations.</li>
            </ul>
          </InfoCard>
        </div>
      </div>
    </PageShell>
  );
}
