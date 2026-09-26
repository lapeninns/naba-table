import { reorderMenuChildrenRoute } from '../../../../../_reorder';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    menuId: string | string[];
    sectionId: string | string[];
  }>;
};

/** PATCH { orderedIds }: the complete new order of this section's items. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return reorderMenuChildrenRoute(request, params, 'items');
}

export const runtime = 'nodejs';
