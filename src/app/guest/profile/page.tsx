import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";


import { ProfileManageForm } from "@/components/profile/ProfileManageForm";
import { normalizeProfileRow, ensureProfileRow } from "@/lib/profile/server";
import { queryKeys } from "@/lib/query/keys";
import { getServerComponentSupabaseClient } from "@/server/supabase";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile · SajiloReserveX",
  description: "Manage your personal details and account settings.",
};

export default async function ProfilePage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin?redirectedFrom=/guest/profile");
  }

  const row = await ensureProfileRow(supabase, user);
  const profile = normalizeProfileRow(row, user.email ?? null);

  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.profile.self(), profile);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Profile</h1>
          <p className="text-slate-600">
            Manage your contact details and how you appear to restaurants.
          </p>
        </div>
        <ProfileManageForm initialProfile={profile} />
      </div>
    </HydrationBoundary>
  );
}
