import { describe, expect, it } from 'vitest';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_FOOTER_CLASS,
  OPS_CARD_HEADER_CLASS,
  OPS_PAGE_CONTENT_STACK_CLASS,
  OPS_PAGE_RHYTHM_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';

describe('opsDensityClasses', () => {
  it('@smoke @contract exposes non-empty class strings for every shared ops density token', () => {
    const tokens = {
      OPS_CARD_CLASS,
      OPS_CARD_CONTENT_CLASS,
      OPS_CARD_FOOTER_CLASS,
      OPS_CARD_HEADER_CLASS,
      OPS_PAGE_CONTENT_STACK_CLASS,
      OPS_PAGE_RHYTHM_CLASS,
    };

    for (const [name, value] of Object.entries(tokens)) {
      expect(typeof value, `${name} should be a string`).toBe('string');
      expect(value.trim().length, `${name} should not be empty`).toBeGreaterThan(0);
    }
  });
});
