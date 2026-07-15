import type { LogFields } from './redaction';

export type WorkerActorContext = {
  readonly distinctId: string;
  readonly actorType: 'anonymous' | 'authenticated_ops';
};

const OPS_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STACK_FRAME_PATTERN = /^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/u;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function resolveWorkerActorContext(
  request: Request,
  service: string,
): Promise<WorkerActorContext> {
  const suppliedActorId = request.headers.get('x-ops-user-id')?.trim() ?? '';
  if (!OPS_USER_ID_PATTERN.test(suppliedActorId)) {
    return { distinctId: `${service}:anonymous`, actorType: 'anonymous' };
  }

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`nabatable:ops:${suppliedActorId}`),
  );
  return {
    distinctId: `ops:${toHex(digest).slice(0, 32)}`,
    actorType: 'authenticated_ops',
  };
}

function parseStackFrames(error: unknown): LogFields[] {
  if (!(error instanceof Error) || !error.stack) return [];

  return error.stack
    .split('\n')
    .slice(1, 21)
    .flatMap((line) => {
      const match = line.match(STACK_FRAME_PATTERN);
      if (!match) return [];
      const [, functionName, filename, lineNumber, columnNumber] = match;
      return [
        {
          platform: 'web:javascript',
          filename,
          function: functionName || '<anonymous>',
          lineno: Number(lineNumber),
          colno: Number(columnNumber),
          in_app: !filename?.includes('node_modules'),
        },
      ];
    });
}

export function buildWorkerExceptionProperties(input: {
  readonly error: unknown;
  readonly service: string;
  readonly actorType: WorkerActorContext['actorType'];
  readonly requestId: string;
  readonly traceId: string;
  readonly deploySha: string;
  readonly method: string;
  readonly path: string;
}): LogFields {
  const type = input.error instanceof Error ? input.error.name : 'UnknownError';
  const value = input.error instanceof Error ? input.error.message : String(input.error);
  const frames = parseStackFrames(input.error);

  return {
    actorType: input.actorType,
    $exception_level: 'error',
    $exception_fingerprint: `${input.service}:${input.method}:${input.path}:${type}`,
    $exception_list: [
      {
        type,
        value,
        mechanism: { handled: false, type: 'middleware' },
        ...(frames.length > 0 ? { stacktrace: { type: 'raw', frames } } : {}),
      },
    ],
    $breadcrumbs: [
      {
        type: 'http',
        category: 'http.request',
        level: 'error',
        message: `${input.method} ${input.path}`,
        data: {
          requestId: input.requestId,
          traceId: input.traceId,
          deploySha: input.deploySha,
        },
      },
    ],
  };
}
