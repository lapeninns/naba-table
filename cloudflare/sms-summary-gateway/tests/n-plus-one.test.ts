import { describe, expect, it } from 'vitest';

import { DAILY_SUMMARY_QUERY_BUDGET } from '../src/supabase';

describe('SMS summary query budget', () => {
  it('keeps target listing and preview loading constant per dispatch @contract', () => {
    expect(DAILY_SUMMARY_QUERY_BUDGET).toEqual({
      listTargets: 1,
      loadPreview: 2,
    });
  });
});
