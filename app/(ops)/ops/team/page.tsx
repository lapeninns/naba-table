import type { Metadata } from "next";
import { redirect } from "next/navigation";

import config from "@/config";
import { TeamManagementClient } from "@/components/ops/team/TeamManagementClient";
import { getServerComponentSupabaseClient } from "@/server/supabase";

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
    const loginUrl = config.auth.loginUrl ?? "/signin";
    redirect(`${loginUrl}?redirectedFrom=/ops/team`);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10">
      <TeamManagementClient />
    </main>
  );
}
