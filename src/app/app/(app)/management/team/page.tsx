import { redirect } from "next/navigation";

import { OpsTeamManagementClient } from "@/components/features";
import config from "@/config";
import { withRedirectedFrom } from "@/lib/url/withRedirectedFrom";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team management · SajiloReserveX",
  description: "Invite teammates and oversee restaurant staff access.",
};

export default async function TeamManagementPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops/team] auth resolution failed", authError.message);
  }

  if (!user) {
    const loginUrl = config.auth.loginUrl ?? "/login";
    redirect(withRedirectedFrom(loginUrl, "/team"));
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8">
      <OpsTeamManagementClient />
    </div>
  );
}
