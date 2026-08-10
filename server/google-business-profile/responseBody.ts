import { GoogleBusinessProfileError } from './errors';

const MAX_RESPONSE_BYTES = 1024 * 1024;

export async function withinGoogleDeadline<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw signal.reason;
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([operation, aborted]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

function malformedResponse(message: string): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError(message, {
    code: 'GBP_MALFORMED_RESPONSE',
    status: 502,
    kind: 'malformed_response',
  });
}

export async function readGoogleJsonResponse(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw malformedResponse('Google provider returned an oversized response.');
  }
  const reader = response.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    if (signal.aborted) throw signal.reason;
    const { done, value } = await withinGoogleDeadline(reader.read(), signal);
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw malformedResponse('Google provider returned an oversized response.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw malformedResponse('Google provider returned malformed JSON.');
    }
    throw error;
  }
}
