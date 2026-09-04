import { createHmac, timingSafeEqual } from 'node:crypto';

type TwilioSmsRequest = {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  messagingServiceSid: string;
  to: string;
  body: string;
  shortenUrls?: boolean;
  statusCallback?: string;
};

type TwilioWhatsAppRequest = {
  readonly accountSid: string;
  readonly apiKeySid: string;
  readonly apiKeySecret: string;
  readonly sender: string;
  readonly to: string;
  readonly contentSid: string;
  readonly contentVariables: Readonly<Record<string, string>>;
  readonly statusCallback?: string;
};

type TwilioSendResult = {
  messageSid: string | null;
  status: string | null;
};

export type TwilioMessageRecord = {
  sid: string;
  status: string | null;
  to: string | null;
  from: string | null;
  body: string | null;
  direction: string | null;
  dateSent: string | null;
  dateCreated: string | null;
  dateUpdated: string | null;
  errorCode: number | null;
  errorMessage: string | null;
  messagingServiceSid: string | null;
  uri: string | null;
  price: string | null;
  priceUnit: string | null;
};

type TwilioListMessagesRequest = {
  accountSid: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  to?: string;
  from?: string;
  dateSent?: string;
  dateSentAfter?: string;
  dateSentBefore?: string;
  pageSize?: number;
  pageToken?: string;
  nextPageUri?: string | null;
};

type TwilioFetchMessageRequest = {
  accountSid: string;
  messageSid: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
};

export type TwilioListMessagesPage = {
  messages: TwilioMessageRecord[];
  nextPageUri: string | null;
};

export type TwilioSmsDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';

type TwilioErrorPayload = {
  code?: number | null;
  message?: string | null;
  status?: number | null;
};

type TwilioMessageApiPayload = {
  sid?: string | null;
  status?: string | null;
  to?: string | null;
  from?: string | null;
  body?: string | null;
  direction?: string | null;
  date_sent?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  error_code?: number | null;
  error_message?: string | null;
  messaging_service_sid?: string | null;
  uri?: string | null;
  price?: string | null;
  price_unit?: string | null;
};

function toBase64(value: string): string {
  if (typeof btoa === 'function') {
    return btoa(value);
  }

  return Buffer.from(value, 'utf-8').toString('base64');
}

function buildBasicAuthHeader(username: string, password: string): string {
  return `Basic ${toBase64(`${username}:${password}`)}`;
}

function resolveTwilioReadCredentials(params: {
  accountSid: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
}): { username: string; password: string } {
  const username = params.apiKeySid ?? params.accountSid;
  const password = params.apiKeySecret ?? params.authToken;
  if (!password) {
    throw new Error('Twilio read credentials are required');
  }

  return { username, password };
}

function parseTwilioErrorPayload(raw: string): TwilioErrorPayload | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as TwilioErrorPayload;
  } catch {
    return null;
  }
}

export class RetryableDispatchError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'RetryableDispatchError';
    this.status = status;
  }
}

export class TerminalDispatchError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'TerminalDispatchError';
    this.status = status;
  }
}

export function buildTwilioSmsRequest(params: TwilioSmsRequest): {
  url: string;
  init: RequestInit;
} {
  const body = new URLSearchParams();
  body.set('To', params.to);
  body.set('Body', params.body);
  body.set('MessagingServiceSid', params.messagingServiceSid);
  if (params.shortenUrls) {
    body.set('ShortenUrls', 'true');
  }
  if (params.statusCallback) {
    body.set('StatusCallback', params.statusCallback);
  }

  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`,
    init: {
      method: 'POST',
      headers: {
        authorization: buildBasicAuthHeader(params.apiKeySid, params.apiKeySecret),
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: body.toString(),
    },
  };
}

export function buildTwilioWhatsAppRequest(params: TwilioWhatsAppRequest): {
  url: string;
  init: RequestInit;
} {
  const body = new URLSearchParams();
  body.set('From', `whatsapp:${params.sender}`);
  body.set('To', `whatsapp:${params.to}`);
  body.set('ContentSid', params.contentSid);
  body.set('ContentVariables', JSON.stringify(params.contentVariables));
  if (params.statusCallback) {
    body.set('StatusCallback', params.statusCallback);
  }

  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`,
    init: {
      method: 'POST',
      headers: {
        authorization: buildBasicAuthHeader(params.apiKeySid, params.apiKeySecret),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  };
}

export function buildTwilioListMessagesRequest(params: TwilioListMessagesRequest): {
  url: string;
  init: RequestInit;
} {
  const url = params.nextPageUri
    ? new URL(params.nextPageUri, 'https://api.twilio.com')
    : new URL(`https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`);

  if (!params.nextPageUri) {
    if (params.to) url.searchParams.set('To', params.to);
    if (params.from) url.searchParams.set('From', params.from);
    if (params.dateSent) url.searchParams.set('DateSent', params.dateSent);
    if (params.dateSentAfter) url.searchParams.set('DateSentAfter', params.dateSentAfter);
    if (params.dateSentBefore) url.searchParams.set('DateSentBefore', params.dateSentBefore);
    if (params.pageSize) url.searchParams.set('PageSize', String(params.pageSize));
    if (params.pageToken) url.searchParams.set('PageToken', params.pageToken);
  }

  const credentials = resolveTwilioReadCredentials(params);

  return {
    url: url.toString(),
    init: {
      method: 'GET',
      headers: {
        authorization: buildBasicAuthHeader(credentials.username, credentials.password),
      },
    },
  };
}

export function buildTwilioFetchMessageRequest(params: TwilioFetchMessageRequest): {
  url: string;
  init: RequestInit;
} {
  const credentials = resolveTwilioReadCredentials(params);

  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages/${params.messageSid}.json`,
    init: {
      method: 'GET',
      headers: {
        authorization: buildBasicAuthHeader(credentials.username, credentials.password),
      },
    },
  };
}

export function isRetryableTwilioStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function mapTwilioMessageStatusToDeliveryStatus(
  status: string | null | undefined,
): TwilioSmsDeliveryStatus | null {
  const normalized = status?.trim().toLowerCase() ?? '';

  switch (normalized) {
    case 'accepted':
    case 'queued':
    case 'scheduled':
    case 'sending':
      return 'queued';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'undelivered':
      return 'undelivered';
    case 'failed':
    case 'canceled':
      return 'failed';
    default:
      return null;
  }
}

function toBase64Digest(secret: string, value: string): string {
  return createHmac('sha1', secret).update(value, 'utf8').digest('base64');
}

function safeEqualBase64(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function validateTwilioWebhookSignature(params: {
  url: string;
  form: URLSearchParams;
  signature: string;
  authToken: string;
}): boolean {
  const pairs = Array.from(params.form.entries()).sort(([a], [b]) => a.localeCompare(b));
  let data = params.url;

  for (const [key, value] of pairs) {
    data += key + value;
  }

  const expected = toBase64Digest(params.authToken, data);
  return safeEqualBase64(expected, params.signature.trim());
}

function parseTwilioMessageRecord(
  message: TwilioMessageApiPayload | null | undefined,
): TwilioMessageRecord | null {
  if (!message?.sid) return null;

  return {
    sid: message.sid,
    status: message.status ?? null,
    to: message.to ?? null,
    from: message.from ?? null,
    body: message.body ?? null,
    direction: message.direction ?? null,
    dateSent: message.date_sent ?? null,
    dateCreated: message.date_created ?? null,
    dateUpdated: message.date_updated ?? null,
    errorCode: message.error_code ?? null,
    errorMessage: message.error_message ?? null,
    messagingServiceSid: message.messaging_service_sid ?? null,
    uri: message.uri ?? null,
    price: message.price ?? null,
    priceUnit: message.price_unit ?? null,
  };
}

export async function sendTwilioSmsMessage(
  params: TwilioSmsRequest & {
    fetchImpl?: typeof fetch;
  },
): Promise<TwilioSendResult> {
  const { url, init } = buildTwilioSmsRequest(params);
  const fetchImpl = params.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new RetryableDispatchError(
      error instanceof Error ? error.message : 'Twilio request failed',
    );
  }

  const raw = await response.text();
  const parsed = parseTwilioErrorPayload(raw);

  if (!response.ok) {
    const message = parsed?.message?.trim() || `Twilio SMS send failed (${response.status})`;
    if (isRetryableTwilioStatus(response.status)) {
      throw new RetryableDispatchError(message, response.status);
    }

    throw new TerminalDispatchError(message, response.status);
  }

  const body = raw ? (JSON.parse(raw) as { sid?: string | null; status?: string | null }) : null;

  return {
    messageSid: body?.sid ?? null,
    status: body?.status ?? null,
  };
}

export async function sendTwilioWhatsAppMessage(
  params: TwilioWhatsAppRequest & {
    readonly fetchImpl?: typeof fetch;
  },
): Promise<TwilioSendResult> {
  const { url, init } = buildTwilioWhatsAppRequest(params);
  const fetchImpl = params.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new RetryableDispatchError(
      error instanceof Error ? error.message : 'Twilio WhatsApp request failed',
    );
  }

  const raw = await response.text();
  const parsed = parseTwilioErrorPayload(raw);
  if (!response.ok) {
    const message = parsed?.message?.trim() || `Twilio WhatsApp send failed (${response.status})`;
    if (isRetryableTwilioStatus(response.status)) {
      throw new RetryableDispatchError(message, response.status);
    }
    throw new TerminalDispatchError(message, response.status);
  }

  const body = raw ? (JSON.parse(raw) as { sid?: string | null; status?: string | null }) : null;
  return {
    messageSid: body?.sid ?? null,
    status: body?.status ?? null,
  };
}

export async function listTwilioMessagesPage(
  params: TwilioListMessagesRequest & { fetchImpl?: typeof fetch },
): Promise<TwilioListMessagesPage> {
  const { url, init } = buildTwilioListMessagesRequest(params);
  const fetchImpl = params.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new RetryableDispatchError(
      error instanceof Error ? error.message : 'Twilio request failed',
    );
  }

  const raw = await response.text();
  const parsed = parseTwilioErrorPayload(raw);

  if (!response.ok) {
    const message = parsed?.message?.trim() || `Twilio message list failed (${response.status})`;
    if (isRetryableTwilioStatus(response.status)) {
      throw new RetryableDispatchError(message, response.status);
    }

    throw new TerminalDispatchError(message, response.status);
  }

  const body = raw
    ? (JSON.parse(raw) as {
        messages?: TwilioMessageApiPayload[];
        next_page_uri?: string | null;
      })
    : null;

  return {
    messages: (body?.messages ?? [])
      .map((message) => parseTwilioMessageRecord(message))
      .filter((message): message is TwilioMessageRecord => Boolean(message)),
    nextPageUri: body?.next_page_uri ?? null,
  };
}

export async function fetchTwilioMessage(
  params: TwilioFetchMessageRequest & { fetchImpl?: typeof fetch },
): Promise<TwilioMessageRecord> {
  const { url, init } = buildTwilioFetchMessageRequest(params);
  const fetchImpl = params.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    throw new RetryableDispatchError(
      error instanceof Error ? error.message : 'Twilio request failed',
    );
  }

  const raw = await response.text();
  const parsed = parseTwilioErrorPayload(raw);

  if (!response.ok) {
    const message = parsed?.message?.trim() || `Twilio message fetch failed (${response.status})`;
    if (isRetryableTwilioStatus(response.status)) {
      throw new RetryableDispatchError(message, response.status);
    }

    throw new TerminalDispatchError(message, response.status);
  }

  const body = raw ? (JSON.parse(raw) as TwilioMessageApiPayload) : null;
  const record = parseTwilioMessageRecord(body);
  if (!record) {
    throw new Error('Twilio message fetch response missing sid');
  }

  return record;
}
