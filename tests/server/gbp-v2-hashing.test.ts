import { describe, expect, it } from 'vitest';

import {
  hashCanonicalJson,
  hashFrozenDecisions,
  hashSectionSnapshots,
} from '@/server/google-business-profile-v2/hashing';

describe('GBP V2 hashing helpers', () => {
  describe('hashCanonicalJson', () => {
    it('returns identical hashes for inputs that differ only in object key order', () => {
      const a = { foo: 'bar', nested: { alpha: 1, beta: 2 } };
      const b = { nested: { beta: 2, alpha: 1 }, foo: 'bar' };
      expect(hashCanonicalJson(a)).toBe(hashCanonicalJson(b));
    });

    it('returns different hashes when array order changes', () => {
      expect(hashCanonicalJson([1, 2, 3])).not.toBe(hashCanonicalJson([3, 2, 1]));
    });

    it('handles primitives, null, and undefined deterministically', () => {
      expect(hashCanonicalJson(null)).toBe(hashCanonicalJson(null));
      expect(hashCanonicalJson('x')).not.toBe(hashCanonicalJson('y'));
      expect(hashCanonicalJson(undefined)).toBe(hashCanonicalJson(undefined));
    });
  });

  describe('hashSectionSnapshots', () => {
    it('preserves caller order (callers must sort if they need set semantics)', () => {
      const sectionsAB = [
        { sectionKey: 'profile', hash: 'h1' },
        { sectionKey: 'operatingHours', hash: 'h2' },
      ];
      const sectionsBA = [
        { sectionKey: 'operatingHours', hash: 'h2' },
        { sectionKey: 'profile', hash: 'h1' },
      ];
      expect(hashSectionSnapshots(sectionsAB)).not.toBe(hashSectionSnapshots(sectionsBA));
    });
  });

  describe('hashFrozenDecisions', () => {
    it('is order-independent across decision inputs (sorts internally)', () => {
      const a = [
        {
          sectionKey: 'profile',
          fieldKey: 'name',
          action: 'import_from_google',
          nabatableValueHash: 'n1',
          googleValueHash: 'g1',
        },
        {
          sectionKey: 'operatingHours',
          fieldKey: 'monday',
          action: 'export_to_google',
          nabatableValueHash: 'n2',
          googleValueHash: 'g2',
        },
      ];
      const b = [a[1], a[0]];
      expect(hashFrozenDecisions(a)).toBe(hashFrozenDecisions(b));
    });

    it('produces a different hash when an action changes', () => {
      const base = [
        {
          sectionKey: 'profile',
          fieldKey: 'name',
          action: 'import_from_google',
          nabatableValueHash: 'n1',
          googleValueHash: 'g1',
        },
      ];
      const flipped = [{ ...base[0], action: 'export_to_google' }];
      expect(hashFrozenDecisions(base)).not.toBe(hashFrozenDecisions(flipped));
    });
  });
});
