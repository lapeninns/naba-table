type TwilioSmsRequest = {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  messagingServiceSid: string;
  to: string;
  body: string;
  shortenUrls?: boolean;
};

type TwilioSendResult = {
  messageSid: string | null;
  status: string | null;
};

type TwilioErrorPayload = {
  code?: number | null;
  message?: string | null;
  status?: number | null;
};

function toBase64(value: string): string {
  if (typeof btoa === 'function') {
    return btoa(value);
  }

  return Buffer.from(value, 'utf-8').toString('base64');
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

  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`,
    init: {
      method: 'POST',
      headers: {
        authorization: `Basic ${toBase64(`${params.apiKeySid}:${params.apiKeySecret}`)}`,
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: body.toString(),
    },
  };
}

export function isRetryableTwilioStatus(status: number): boolean {
  return status === 429 || status >= 500;
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
