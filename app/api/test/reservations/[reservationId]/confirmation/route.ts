import { NextRequest, NextResponse } from 'next/server';

import { guardTestRoute } from '@/server/test-api';
import { getServiceSupabaseClient } from '@/server/supabase';

export const dynamic = 'force-dynamic';

const PDF_BASE64 =
  'JVBERi0xLjMKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSCj4+CmVuZG9iagoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkcyBbMyAwIFJdCj4+CmVuZG9iagoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94IFswIDAgNTk1IDg0Ml0vQ29udGVudHMgNCAwIFIvUmVzb3VyY2VzIDw8L0ZvbnQgPDwvRjEgNSAwIFI+Pj4+Pj4KZW5kb2JqCgo0IDAgb2JqCjw8L0xlbmd0aCA3OCA+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjcyIDc2MCBUZAooUmVzZXJ2YXRpb24gQ29uZmlybWF0aW9uKSBUagplbmRzdHJlYW0KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+CmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE3IDAwMDAwIG4gCjAwMDAwMDAwNjMgMDAwMDAgbiAKMDAwMDAwMDE1MyAwMDAwMCBuIAowMDAwMDAwMjU1IDAwMDAwIG4gCjAwMDAwMDAzMzMgMDAwMDAgbiAKdHJhaWxlcgo8PC9Sb290IDEgMCBSL1NpemUgNj4+CnN0YXJ0eHJlZgoyOTYKJSVFT0YK';

export async function GET(req: NextRequest, context: { params: { reservationId: string } }) {
  const guard = guardTestRoute(req);
  if (guard) return guard;

  const reservationId = context.params.reservationId;

  const service = getServiceSupabaseClient();
  const { data, error } = await service
    .from('bookings')
    .select('reference')
    .eq('id', reservationId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
  }

  const file = Buffer.from(PDF_BASE64, 'base64');

  return new NextResponse(file, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reservation-${data.reference ?? reservationId}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
