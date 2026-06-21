import { normalizeEmail } from '@/server/customers';
import { getServiceSupabaseClient } from '@/server/supabase';

// Email-keyed suppression list (table: public.email_unsubscribes). Unlike the
// profile-bound flag in recipient-suppression.ts, this honours any recipient — including
// guests who book without an account — and is the backing store for one-click
// List-Unsubscribe (RFC 8058) plus Resend bounce/complaint feedback.
//
// Suppression has two tiers, keyed by `reason`:
//   - HARD (bounce, complaint, manual): stops ALL mail — the address is undeliverable,
//     flagged us as spam, or was deliberately blocked.
//   - SOFT (one_click): a marketing opt-out — stops OPTIONAL mail (review requests,
//     marketing) but leaves essential booking/auth mail flowing.

export type EmailSuppressionReason = 'one_click' | 'complaint' | 'bounce' | 'manual';

const HARD_SUPPRESSION_REASONS: ReadonlySet<EmailSuppressionReason> = new Set<EmailSuppressionReason>([
  'bounce',
  'complaint',
  'manual',
]);

export type EmailSuppressionStates = {
  /** Addresses that should receive NO mail at all. */
  hard: string[];
  /** Addresses that opted out of OPTIONAL mail only. */
  soft: string[];
};

type EmailUnsubscribeRow = {
  email: string;
  reason: EmailSuppressionReason | string;
};

type SupabaseLikeError = { message: string };

// The `email_unsubscribes` table is newer than the committed generated Supabase types
// (types/supabase.ts), so we use a narrowly-typed client cast — the same pattern as
// server/bookings/confirmation-notifications.ts — until the types are regenerated.
type EmailSuppressionClient = {
  from: (table: 'email_unsubscribes') => {
    upsert: (
      row: {
        email: string;
        reason: EmailSuppressionReason;
        metadata: Record<string, unknown> | null;
        updated_at: string;
      },
      options: { onConflict: 'email' },
    ) => PromiseLike<{ error: SupabaseLikeError | null }>;
    select: (columns: 'email, reason') => {
      in: (
        column: 'email',
        values: string[],
      ) => PromiseLike<{ data: EmailUnsubscribeRow[] | null; error: SupabaseLikeError | null }>;
    };
  };
};

/**
 * Records an unsubscribe/suppression for the given email. Idempotent: re-suppressing an
 * already-suppressed address updates the reason and timestamp rather than erroring.
 */
export async function addEmailToSuppressionList(
  email: string,
  reason: EmailSuppressionReason,
  metadata?: Record<string, unknown>,
): Promise<{ suppressed: boolean }> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { suppressed: false };
  }

  const nowIso = new Date().toISOString();
  const supabase = getServiceSupabaseClient() as unknown as EmailSuppressionClient;
  const { error } = await supabase.from('email_unsubscribes').upsert(
    {
      email: normalizedEmail,
      reason,
      metadata: metadata ?? null,
      updated_at: nowIso,
    },
    { onConflict: 'email' },
  );

  if (error) {
    throw new Error(`Failed to add email to suppression list: ${error.message}`);
  }

  return { suppressed: true };
}

/**
 * Resolves the suppression tier for each of the given emails. Returns normalized emails
 * partitioned into `hard` (block all mail) and `soft` (block optional mail only).
 */
export async function getEmailSuppressionStates(emails: string[]): Promise<EmailSuppressionStates> {
  const normalizedEmails = [...new Set(emails.map((value) => normalizeEmail(value)).filter(Boolean))];

  if (normalizedEmails.length === 0) {
    return { hard: [], soft: [] };
  }

  const supabase = getServiceSupabaseClient() as unknown as EmailSuppressionClient;
  const { data, error } = await supabase
    .from('email_unsubscribes')
    .select('email, reason')
    .in('email', normalizedEmails);

  if (error) {
    throw new Error(`Failed to resolve email suppression list: ${error.message}`);
  }

  const hard = new Set<string>();
  const soft = new Set<string>();

  for (const row of data ?? []) {
    const email = normalizeEmail(row.email);
    if (!email) continue;
    if (HARD_SUPPRESSION_REASONS.has(row.reason as EmailSuppressionReason)) {
      hard.add(email);
    } else {
      soft.add(email);
    }
  }

  return { hard: [...hard], soft: [...soft] };
}

/**
 * Returns the subset of the given emails that are suppressed for ANY reason (hard or
 * soft). Kept for callers that don't care about the tier.
 */
export async function getSuppressedEmailsFromList(emails: string[]): Promise<string[]> {
  const states = await getEmailSuppressionStates(emails);
  return [...new Set([...states.hard, ...states.soft])];
}

/** Convenience single-email check (any suppression tier). */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const suppressed = await getSuppressedEmailsFromList([email]);
  return suppressed.length > 0;
}
