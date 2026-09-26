import { NextResponse } from 'next/server';

import { internalError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { withOpsMutation } from '@/server/auth/guards';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/config/merge-rules';

export async function GET(request: NextRequest) {
  const authorization = await withOpsMutation(request);
  if (!authorization.ok) {
    return authorization.response;
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const { data, error } = await supabase
      .from('merge_rules')
      .select(
        'id, from_a, from_b, to_capacity, enabled, require_same_zone, require_adjacency, cross_category_merge',
      )
      .order('from_a', { ascending: true })
      .order('from_b', { ascending: true });

    if (error) {
      return internalError(
        error,
        { route: ROUTE, errorKind: error.code },
        'Failed to load merge rules',
      );
    }

    return NextResponse.json({
      rules: (data ?? []).map((rule) => ({
        id: rule.id,
        from: [rule.from_a, rule.from_b],
        toCapacity: rule.to_capacity,
        enabled: rule.enabled,
        requireSameZone: rule.require_same_zone,
        requireAdjacency: rule.require_adjacency,
        crossCategoryMerge: rule.cross_category_merge,
      })),
    });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'api', kind: 'config-merge-rules' },
    });
    return internalError(error, { route: ROUTE }, 'An unexpected error occurred');
  }
}
