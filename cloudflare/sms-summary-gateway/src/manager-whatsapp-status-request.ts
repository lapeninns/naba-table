import { json, isValidLocalDate } from './gateway-http';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_PARAMS = 64;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export type ManagerWhatsAppStatusInput = {
  callbackToken: string;
  localDate: string;
  providerStatus: string;
  recipient: string;
  restaurantId: string;
  whatsappMessageSid: string;
};

type ParseResult =
  | { input: ManagerWhatsAppStatusInput; response?: never }
  | { input?: never; response: Response };

async function readTwilioForm(request: Request): Promise<URLSearchParams | Response> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') {
    return json({ error: 'Unsupported media type' }, { status: 415 });
  }
  const contentLength = Number.parseInt(request.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Payload too large' }, { status: 413 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'Payload too large' }, { status: 413 });
  }
  const form = new URLSearchParams(rawBody);
  return Array.from(form.keys()).length > MAX_PARAMS
    ? json({ error: 'Too many parameters' }, { status: 400 })
    : form;
}

function parseInput(request: Request, form: URLSearchParams): ManagerWhatsAppStatusInput | null {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get('restaurantId')?.trim() ?? '';
  const localDate = url.searchParams.get('localDate')?.trim() ?? '';
  const callbackToken = url.searchParams.get('callbackToken')?.trim() ?? '';
  const whatsappMessageSid = form.get('MessageSid')?.trim() ?? '';
  const providerStatus = form.get('MessageStatus')?.trim().toLowerCase() ?? '';
  const recipient = (form.get('To') ?? '').trim().replace(/^whatsapp:/i, '');
  if (
    !UUID_PATTERN.test(restaurantId) ||
    !isValidLocalDate(localDate) ||
    !UUID_PATTERN.test(callbackToken) ||
    !whatsappMessageSid ||
    !providerStatus ||
    !E164_PATTERN.test(recipient)
  ) {
    return null;
  }
  return {
    callbackToken,
    localDate,
    providerStatus,
    recipient,
    restaurantId,
    whatsappMessageSid,
  };
}

export async function parseManagerWhatsAppStatusRequest(request: Request): Promise<ParseResult> {
  const form = await readTwilioForm(request);
  if (form instanceof Response) return { response: form };
  const input = parseInput(request, form);
  return input
    ? { input }
    : { response: json({ error: 'Invalid Twilio status callback' }, { status: 400 }) };
}
