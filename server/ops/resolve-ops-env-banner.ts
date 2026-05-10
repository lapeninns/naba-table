import { getEnv } from '@/lib/env';
import { resolveServiceRoleSupabaseUrl } from '@/server/supabase';

/**
 * Message shown at the top of the authenticated Ops shell when operators should
 * be aware of non-standard data routing (read replica, shared prod resources, etc.).
 */
export function resolveOpsEnvBanner(): string | null {
  const parsed = getEnv();
  const explicit = parsed.OPS_ENV_BANNER?.trim();
  if (explicit) {
    return explicit;
  }

  const primaryUrl = parsed.NEXT_PUBLIC_SUPABASE_URL;
  if (resolveServiceRoleSupabaseUrl() !== primaryUrl) {
    return 'Ops server reads use the Supabase read-replica URL. Writes from APIs or background jobs may fail. Sign-in still uses the primary Supabase URL.';
  }

  return null;
}
