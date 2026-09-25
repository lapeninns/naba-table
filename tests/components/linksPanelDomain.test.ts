import { describe, expect, it } from 'vitest';

import {
  getLinkRemoveLabel,
  getLinkTypeLabel,
  LINK_TEXT_FIELDS,
} from '@/components/features/restaurant-settings/discovery/panels/linksPanelDomain';

import type { LinkEditor } from '@/components/features/restaurant-settings/businessContextModel';

const buildLink = (overrides: Partial<LinkEditor> = {}): LinkEditor => ({
  id: 'link-1',
  linkType: 'website',
  label: 'Website',
  url: 'https://example.com',
  isPrimary: false,
  ...overrides,
});

describe('linksPanelDomain', () => {
  it('keeps link text field specs stable', () => {
    expect(LINK_TEXT_FIELDS.map((field) => field.field)).toEqual(['label', 'url']);
    expect(LINK_TEXT_FIELDS.find((field) => field.field === 'url')).toMatchObject({
      label: 'Web address',
      placeholder: 'https://',
      inputMode: 'url',
      type: 'url',
    });
  });

  it('looks up link type labels from editable link options', () => {
    expect(getLinkTypeLabel('website')).toBe('Website');
    expect(getLinkTypeLabel('unknown-type')).toBeNull();
  });

  it('names links for remove buttons from label, then type label, then fallback', () => {
    expect(getLinkRemoveLabel(buildLink({ label: 'Our site' }))).toBe('Our site link');
    expect(getLinkRemoveLabel(buildLink({ label: '' }))).toBe('Website link');
    expect(getLinkRemoveLabel(buildLink({ label: '  ', linkType: 'unknown-type' }))).toBe(
      'new link',
    );
  });
});
