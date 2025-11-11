import { NextResponse } from 'next/server';

import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getServiceSupabaseClient } from '@/server/supabase';
import { buildReservationConfirmationPdfBuffer } from '@/server/reservations/confirmation-pdf';

import type { NextRequest} from 'next/server';

export const dynamic = 'force-dynamic';

type RouteParams = {
  params: Promise<{ reservationId: string | string[] }>;
};

export async function GET(req: NextRequest, context: RouteParams) {
  const guard = guardTestEndpoint();
  if (guard) return guard;

  const { reservationId } = await context.params;
  const normalizedReservationId = Array.isArray(reservationId) ? reservationId[0] : reservationId;

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
