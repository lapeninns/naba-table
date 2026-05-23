import { describe, expect, it } from 'vitest';

import {
  getLinkRemoveLabel,
  getLinkRowTitle,
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
      placeholder: 'https://example.com',
      inputMode: 'url',
      type: 'url',
    });
  });

  it('looks up link type labels from editable link options', () => {
    expect(getLinkTypeLabel('website')).toBe('Website');
    expect(getLinkTypeLabel('unknown-type')).toBeNull();
  });

  it('derives row titles from label, option label, then fallback', () => {
    expect(getLinkRowTitle(buildLink())).toBe('Website');
    expect(getLinkRowTitle(buildLink({ label: '' }))).toBe('Website');
    expect(getLinkRowTitle(buildLink({ label: '', linkType: 'unknown-type' }))).toBe('New link');
  });

  it('derives remove labels from label, raw link type, then fallback', () => {
    expect(getLinkRemoveLabel(buildLink())).toBe('Website');
    expect(getLinkRemoveLabel(buildLink({ label: '' }))).toBe('website');
    expect(getLinkRemoveLabel(buildLink({ label: '', linkType: '' }))).toBe('link');
  });
});
