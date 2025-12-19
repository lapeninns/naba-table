"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useGuestServices } from "@/guest/services/di";
import { queryKeys } from "@/lib/query/keys";

import type { HttpError } from "@/lib/http/errors";
import type { ProfileResponse } from "@/lib/profile/schema";

export const useGuestProfile = (): UseQueryResult<ProfileResponse, HttpError> => {
  const services = useGuestServices();

  return useQuery<ProfileResponse, HttpError>({
    queryKey: queryKeys.profile.self(),
    queryFn: () => services.profile.getSelf(),
    staleTime: 5 * 60 * 1000,
  });
};
