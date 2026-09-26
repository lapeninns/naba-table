import { reorderMenuChildrenRoute } from '../../../_reorder';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[]; menuId: string | string[] }>;
};

/** PATCH { orderedIds }: the complete new order of this menu's sections. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return reorderMenuChildrenRoute(request, params, 'sections');
}

export const runtime = 'nodejs';
