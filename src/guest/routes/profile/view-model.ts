import { QueryClient, dehydrate, type DehydratedState } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";

import type { GuestServerServices } from "@/guest/services/server";
import type { ProfileResponse } from "@/lib/profile/schema";

export type GuestProfileViewModel = {
  dehydratedState: DehydratedState;
  profile: ProfileResponse;
};

export const buildGuestProfileViewModel = async (
  services: GuestServerServices,
): Promise<GuestProfileViewModel> => {
  const user = await services.auth.requireUser({
    redirectTo: "/auth/signin",
    redirectedFrom: "/guest/profile",
  });

  const queryClient = new QueryClient();

  const profile = await services.profile.ensureForUser(user);
  queryClient.setQueryData(queryKeys.profile.self(), profile);

  return {
    dehydratedState: dehydrate(queryClient),
    profile,
  };
};
