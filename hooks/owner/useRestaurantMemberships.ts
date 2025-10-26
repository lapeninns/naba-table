'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import {
  restaurantMembershipResponseSchema,
  type RestaurantMembership,
} from '@/lib/owner/team/schema';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';


export function useRestaurantMemberships(): UseQueryResult<RestaurantMembership[], HttpError> {
  return useQuery<RestaurantMembership[], HttpError>({
    queryKey: queryKeys.team.memberships(),
    queryFn: async () => {
      const data = await fetchJson<unknown>('/api/owner/team/memberships');
      const parsed = restaurantMembershipResponseSchema.parse(data);
      return parsed.memberships;
    },
    staleTime: 2 * 60 * 1000,
  });
}
