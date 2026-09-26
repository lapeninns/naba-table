import { describe, expect, it } from 'vitest';

import {
  GBP_SCENARIOS,
  GBP_TERMINAL_NOTICES,
  gbpExactPreview,
  gbpOperatorStateFor,
  gbpPublishResponse,
  type GbpScenario,
} from '@/src/app/(public)/dev/_mocks/gbp/gbpFixtures';
import {
  gbpConnectionStateResponseV1Schema,
  gbpPublishResponseV1Schema,
  gbpTerminalNoticesResponseV1Schema,
  parseGbpExactPreviewResponseV1,
} from '@/server/dual-sync/contracts';

// The dev harness serves these over fetch and the app's own clients parse them, so they must
// satisfy the real V1 contracts or the harness would show error states instead of the scenario.
describe('GBP dev harness fixtures', () => {
  it.each(Object.keys(GBP_SCENARIOS) as GbpScenario[])(
    'the %s operator state satisfies the V1 contract',
    (scenario) => {
      const parsed = gbpConnectionStateResponseV1Schema.safeParse(gbpOperatorStateFor(scenario));
      expect(parsed.error?.issues ?? []).toEqual([]);
    },
  );

  it('notices, exact previews and publish responses satisfy their contracts', () => {
    expect(
      gbpTerminalNoticesResponseV1Schema.safeParse(GBP_TERMINAL_NOTICES).error?.issues ?? [],
    ).toEqual([]);
    const preview = gbpExactPreview(['profile.description', 'foodMenus.items.mains.chicken-momo']);
    expect(() => parseGbpExactPreviewResponseV1(preview)).not.toThrow();
    expect(
      gbpPublishResponseV1Schema.safeParse(
        gbpPublishResponse(preview.groups.map((group) => group.groupId)),
      ).error?.issues ?? [],
    ).toEqual([]);
  });
});
