import { describe, expect, it } from 'vitest';

import {
  hashCanonicalJson,
  hashSectionSnapshots,
} from '@/server/dual-sync/hashing';

describe('dual-sync hashing helpers', () => {
  describe('hashCanonicalJson', () => {
    it('returns identical hashes for inputs that differ only in object key order', () => {
      const a = { foo: 'bar', nested: { alpha: 1, beta: 2 } };
      const b = { nested: { beta: 2, alpha: 1 }, foo: 'bar' };
      expect(hashCanonicalJson(a)).toBe(hashCanonicalJson(b));
    });

    it('returns different hashes when array order changes', () => {
      expect(hashCanonicalJson([1, 2, 3])).not.toBe(hashCanonicalJson([3, 2, 1]));
    });

    it('returns null for null and undefined', () => {
      expect(hashCanonicalJson(null)).toBeNull();
      expect(hashCanonicalJson(undefined)).toBeNull();
    });

    it('returns hex digests for primitives', () => {
      expect(hashCanonicalJson('hello')).toMatch(/^[0-9a-f]{64}$/);
      expect(hashCanonicalJson(42)).toMatch(/^[0-9a-f]{64}$/);
      expect(hashCanonicalJson(true)).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('hashSectionSnapshots', () => {
    it('is order-independent across input list', () => {
      const a = [
        { sectionKey: 'profile', hash: 'h1' },
        { sectionKey: 'operatingHours', hash: 'h2' },
      ];
      const b = [a[1], a[0]];
      expect(hashSectionSnapshots(a)).toBe(hashSectionSnapshots(b));
    });

    it('treats null hashes as canonical null', () => {
      const a = [
        { sectionKey: 'profile', hash: null },
        { sectionKey: 'operatingHours', hash: 'h2' },
      ];
      const b = [
        { sectionKey: 'operatingHours', hash: 'h2' },
        { sectionKey: 'profile', hash: null },
      ];
      expect(hashSectionSnapshots(a)).toBe(hashSectionSnapshots(b));
    });
  });
});
