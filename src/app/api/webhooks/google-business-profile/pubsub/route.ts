import { env } from '@/lib/env';
import {
  createSupabaseGooglePubsubPersistence,
  handleGoogleBusinessProfilePush,
} from '@/server/dual-sync/pubsub';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { GooglePubsubIngressConfig } from '@/server/dual-sync/pubsub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  Vary: 'Authorization',
} as const;

function ingressConfig(): GooglePubsubIngressConfig | null {
  const config = env.dualSync.pubsubIngress;
  if (
    !config.enabled ||
    !config.expectedAudience ||
    !config.pushServiceAccountEmail ||
    !config.subscription
  ) {
    return null;
  }
  return {
    enabled: true,
    expectedAudience: config.expectedAudience,
    pushServiceAccountEmail: config.pushServiceAccountEmail,
    subscription: config.subscription,
  };
}

export async function POST(request: Request): Promise<Response> {
  const config = ingressConfig();
  if (!config) return new Response(null, { status: 404, headers: NO_STORE_HEADERS });
  return handleGoogleBusinessProfilePush(request, config, {
    persist: createSupabaseGooglePubsubPersistence(getServiceSupabaseClient()).persist,
  });
}
