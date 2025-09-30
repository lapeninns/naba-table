import { describe, expect, it } from 'vitest';

import { profileUpdateSchema } from '@/lib/profile/schema';

describe('profileUpdateSchema', () => {
  it('normalizes trimmed name, phone, and image', () => {
    const payload = profileUpdateSchema.parse({
      name: '  Ada  ',
      phone: '  +1 (415) 555-0100  ',
      image: ' https://example.com/avatar.png ',
    });
    expect(payload).toEqual({
      name: 'Ada',
      phone: '+1 (415) 555-0100',
      image: 'https://example.com/avatar.png',
    });
  });

  it('allows clearing name and image to null', () => {
    const payload = profileUpdateSchema.parse({ name: '', phone: '', image: '' });
    expect(payload).toEqual({ name: null, phone: null, image: null });
  });

  it('omits fields when not present', () => {
    const payload = profileUpdateSchema.parse({});
    expect(payload).toEqual({});
  });

  it('rejects invalid image protocol', () => {
    const result = profileUpdateSchema.safeParse({ image: 'http://example.com/avatar.png' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid phone value', () => {
    const result = profileUpdateSchema.safeParse({ phone: 'abc' });
    expect(result.success).toBe(false);
  });
});
