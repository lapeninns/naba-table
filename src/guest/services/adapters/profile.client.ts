import { fetchJson } from "@/lib/http/fetchJson";
import { profileResponseSchema } from "@/lib/profile/schema";

import type { ProfilePort } from "../ports";

export const createClientProfilePort = (): ProfilePort => {
  const getSelf: ProfilePort["getSelf"] = async () => {
    const data = await fetchJson<unknown>("/api/profile");
    const profile = (data as { profile?: unknown })?.profile ?? data;
    return profileResponseSchema.parse(profile);
  };

  return {
    getSelf,
    ensureForUser: async (_user) => getSelf(),
  };
};
