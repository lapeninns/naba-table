import { reorderMenuChildrenRoute } from '../../../../../../../_reorder';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    menuId: string | string[];
    sectionId: string | string[];
    itemId: string | string[];
  }>;
};

/** PATCH { orderedIds }: the complete new order of this item's options. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return reorderMenuChildrenRoute(request, params, 'options');
}

export const runtime = 'nodejs';
