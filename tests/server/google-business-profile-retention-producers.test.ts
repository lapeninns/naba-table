import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function providerSource(file: string): string {
  return readFileSync(join(process.cwd(), 'server/google-business-profile', file), 'utf8');
}

describe('GBP retention producer boundaries', () => {
  it('does not retain legacy canonical, review, publish, or workflow payload copies', () => {
    const allProviderSource = [
      'businessInfoSyncPersistence.ts',
      'food-menus-import-review-storage.ts',
      'food-menus-publish-attempt-storage.ts',
      'food-menus-storage-payloads.ts',
      'workflowDraftLifecycle.ts',
      'workflowRepository.ts',
    ]
      .map(providerSource)
      .join('\n');

    expect(allProviderSource).not.toContain('replace_gbp_canonical_business_info');
    expect(allProviderSource).not.toContain('replace_pending_food_menus_import_reviews');
    expect(allProviderSource).not.toMatch(/canonical_food_menus:\s*canonical/);
    expect(allProviderSource).not.toMatch(/projected_payload:\s*projected/);
    expect(allProviderSource).not.toMatch(/google_response:\s*google/);
    expect(allProviderSource).not.toMatch(/section_diffs:\s*toJson/);
    expect(allProviderSource).not.toMatch(/(?:old_values|new_values):\s*toJson/);
    expect(allProviderSource).not.toMatch(
      /preflight_(?:nabatable_updates|pull_only_items):\s*toJson/,
    );
  });
});
