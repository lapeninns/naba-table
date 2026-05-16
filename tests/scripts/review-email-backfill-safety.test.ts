import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readScript(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('review email backfill script safety', () => {
  it('guards the lifecycle backfill apply path before constructing a service-role client', () => {
    const source = readScript('scripts/backfill-review-emails.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertProductionApiScriptSafety');
    expect(source).toContain('CONFIRM_REVIEW_EMAIL_BACKFILL');
    expect(source).toContain('TARGET_RESTAURANT_ID');
    expect(source).toContain('ALLOW_ALL_RESTAURANTS_BACKFILL');
    expect(source).toContain('CONFIRM_REVIEW_EMAIL_GLOBAL_BACKFILL');
    expect(source).toContain("process.env.UPDATE_EMAIL_PREFS === 'true'");
    expect(source).toContain('CONFIRM_REVIEW_EMAIL_PREF_UPDATE');
    expect(source).toContain('restaurantsNeedingPreferenceUpdate');
    expect(source).toContain('fetchRestaurants(supabase, TARGET_RESTAURANT_ID)');
    expect(mainBody.indexOf('assertReviewBackfillApplySafety()')).toBeLessThan(
      mainBody.indexOf('const supabase = getServiceSupabaseClient()'),
    );
    expect(source.indexOf('restaurantsNeedingPreferenceUpdate.set')).toBeLessThan(
      source.indexOf('update({ email_send_review_request: true })'),
    );
  });

  it('dedupes queued review requests against dispatch intents before enqueueing', () => {
    const source = readScript('scripts/queues/backfill-review-request-jobs.ts');
    const mainBody = source.slice(source.indexOf('async function main()'));

    expect(source).toContain('assertProductionApiScriptSafety');
    expect(source).toContain('CONFIRM_REVIEW_EMAIL_BACKFILL');
    expect(source).toContain('TARGET_RESTAURANT_ID');
    expect(source).toContain('ALLOW_ALL_RESTAURANTS_BACKFILL');
    expect(source).toContain('queryExistingReviewIntents');
    expect(source).toContain("from('email_dispatch_intents')");
    expect(source).toContain('review_request:${id}');
    expect(source).toContain('existingIntentBookingIds');
    expect(source).toContain('refusing to enqueue review requests');
    expect(mainBody.indexOf('assertReviewQueueBackfillSafety(args)')).toBeLessThan(
      mainBody.indexOf('const supabase = getServiceSupabaseClient()'),
    );
    expect(source.indexOf('queryExistingReviewIntents')).toBeLessThan(
      source.indexOf('await enqueueEmailJob'),
    );
    expect(source).toContain(
      '(b) => !sentBookingIds.has(b.id) && !existingIntentBookingIds.has(b.id)',
    );
  });
});
