import { NextResponse } from 'next/server';

import { getOccasionCatalog } from '@/server/occasions/catalog';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

export async function GET() {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/occasions][GET] failed to resolve auth', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const catalog = await getOccasionCatalog();
    return NextResponse.json({ occasions: catalog.definitions });
  } catch (error) {
    console.error('[ops/occasions][GET] failed to load occasions', error);
    return NextResponse.json({ error: 'Unable to load occasions' }, { status: 500 });
  }
}
