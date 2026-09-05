import { NextResponse } from 'next/server';

import {
  buildGitHubDispatchRequest,
  classifyInsightSeverity,
  isAuthorizedInsightRequest,
  parseErrorInsight,
  parseErrorInsightEvent,
  recordErrorInsightIncident,
  resolveInsightEnvironment,
  shouldDispatchIncident,
  toIncidentContext,
} from '@/lib/observability/error-insight';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const receiverToken = process.env.ERROR_INSIGHT_RECEIVER_TOKEN?.trim() ?? '';
  const githubToken = process.env.ERROR_INSIGHT_GITHUB_TOKEN?.trim() ?? '';
  const repository = process.env.ERROR_INSIGHT_GITHUB_REPOSITORY?.trim() ?? 'lapeninns/nabatable';
  if (!receiverToken || !githubToken) {
    return NextResponse.json({ error: 'Error insight receiver not configured' }, { status: 503 });
  }

  if (!isAuthorizedInsightRequest(receiverToken, request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const insight = parseErrorInsight(payload);
  const event = parseErrorInsightEvent(payload);
  if (!insight || !event) {
    return NextResponse.json({ error: 'Invalid error insight payload' }, { status: 400 });
  }

  const outcome = await recordErrorInsightIncident({
    insight,
    environment: resolveInsightEnvironment(process.env),
    severity: classifyInsightSeverity(event).severity,
    observedAt: new Date(),
  });
  const incident = toIncidentContext(outcome);

  if (!shouldDispatchIncident(outcome.transition)) {
    return NextResponse.json({ accepted: true, incident }, { status: 202 });
  }

  const dispatch = buildGitHubDispatchRequest(
    insight,
    {
      token: githubToken,
      repository,
    },
    incident,
  );
  const response = await fetch(dispatch.url, dispatch.init);
  if (!response.ok) {
    return NextResponse.json({ error: 'GitHub dispatch failed' }, { status: 502 });
  }

  return NextResponse.json({ accepted: true, incident }, { status: 202 });
}
