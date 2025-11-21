import { NextResponse } from 'next/server';

import { buildReservationConfirmationPdfBuffer } from '@/server/reservations/confirmation-pdf';
import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest} from 'next/server';

export const dynamic = 'force-dynamic';

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

export async function GET(req: NextRequest, context: RouteParams) {
  const guard = guardTestEndpoint(req);
  if (guard) return guard;

  const { id } = await context.params;
  const normalizedReservationId = Array.isArray(id) ? id[0] : id;

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from('bookings')
    .select('reference')
    .eq('id', normalizedReservationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
  }

  const file = buildReservationConfirmationPdfBuffer();
  const pdfArrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;

  return new NextResponse(pdfArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reservation-${data.reference ?? normalizedReservationId}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
