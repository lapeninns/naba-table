import { redirect } from "next/navigation";

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

  return <ProfileManageForm initialProfile={profile} />;
}
