import { z } from 'zod';

import { recordObservabilityEvent } from '@/server/observability';

export const runtime = 'nodejs';

const RequestSchema = z.object({
  type: z.enum(['access', 'delete']),
  email: z.string().email(),
  message: z.string().max(2000).optional(),
});

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(digest).toString('hex');
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const emailHash = await sha256Hex(parsed.data.email.toLowerCase());

  await recordObservabilityEvent({
    source: 'privacy',
    eventType: 'privacy.dsar.requested',
    severity: 'notice',
    context: {
      type: parsed.data.type,
      emailHash,
      messageLength: parsed.data.message?.length ?? 0,
    },
  });

  return Response.json({ ok: true }, { status: 202 });
}
