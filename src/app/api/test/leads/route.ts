import { NextResponse } from 'next/server';
import { z } from 'zod';

import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest} from 'next/server';

export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  email: z.string().email(),
});

export async function DELETE(req: NextRequest) {
  const guard = guardTestEndpoint();
  if (guard) return guard;

  const parsed = payloadSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from('leads')
    .delete()
    .eq('email', parsed.data.email.toLowerCase())
    .select('email');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: data?.length ?? 0 });
}
