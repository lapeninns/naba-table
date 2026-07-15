import { NextResponse } from 'next/server';

import {
  buildGitHubDispatchRequest,
  isAuthorizedInsightRequest,
  parseWorkerErrorInsight,
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

  const insight = parseWorkerErrorInsight(payload);
  if (!insight) {
    return NextResponse.json({ error: 'Invalid error insight payload' }, { status: 400 });
  }

  const dispatch = buildGitHubDispatchRequest(insight, {
    token: githubToken,
    repository,
  });
  const response = await fetch(dispatch.url, dispatch.init);
  if (!response.ok) {
    return NextResponse.json({ error: 'GitHub dispatch failed' }, { status: 502 });
  }

  return NextResponse.json({ accepted: true }, { status: 202 });
}
