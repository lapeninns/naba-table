import { describe, expect, it } from 'vitest';

import {
  draftsReducer,
  isDraftDirty,
  type DraftsState,
} from '@/components/features/email-templates/model/emailTemplateDrafts';
import { getDefaultTemplateVariants } from '@/lib/restaurants/email-templates';

const key = 'confirmation' as const;
const base = getDefaultTemplateVariants(key);
const [first, second, third] = base as [
  (typeof base)[number],
  (typeof base)[number],
  (typeof base)[number],
];

function edit(state: DraftsState, field: 'subject' | 'intro', value: string, variantId = first.id) {
  return draftsReducer(state, { type: 'edit', key, base, variantId, field, value });
}

describe('draftsReducer', () => {
  it('copies the saved variants into a draft on the first edit', () => {
    const state = edit({}, 'subject', 'New subject');

    expect(state[key]?.[0]?.subject).toBe('New subject');
    expect(state[key]?.[1]).toEqual(second);
    expect(isDraftDirty(state[key], base)).toBe(true);
  });

  it('is not dirty once edits return to the saved copy', () => {
    const edited = edit({}, 'subject', 'New subject');
    const back = edit(edited, 'subject', first.subject);

    expect(isDraftDirty(back[key], base)).toBe(false);
  });

  it('sets live, adds, moves and deletes, keeping order contiguous', () => {
    let state = draftsReducer(
      {},
      { type: 'set-live', key, base, variantId: second.id, isActive: false },
    );
    expect(state[key]?.[1]?.isActive).toBe(false);

    state = draftsReducer(state, {
      type: 'add',
      key,
      base,
      variant: { ...first, id: 'new', name: 'New', isActive: false, order: 3 },
    });
    expect(state[key]?.map((v) => v.id)).toEqual([first.id, second.id, third.id, 'new']);

    state = draftsReducer(state, { type: 'move', key, base, variantId: 'new', direction: -1 });
    expect(state[key]?.map((v) => v.id)).toEqual([first.id, second.id, 'new', third.id]);

    state = draftsReducer(state, { type: 'move', key, base, variantId: first.id, direction: -1 });
    expect(state[key]?.[0]?.id).toBe(first.id);

    state = draftsReducer(state, { type: 'delete', key, base, variantId: second.id });
    expect(state[key]?.map((v) => [v.id, v.order])).toEqual([
      [first.id, 0],
      ['new', 1],
      [third.id, 2],
    ]);
  });

  it('never deletes the last variant', () => {
    const only = [first];
    const state = draftsReducer({}, { type: 'delete', key, base: only, variantId: first.id });
    expect(state[key]).toBeUndefined();
  });

  it('discards one template and clears all drafts on a restaurant switch', () => {
    const edited = edit({}, 'subject', 'x');
    expect(draftsReducer(edited, { type: 'discard', key })[key]).toBeUndefined();
    expect(draftsReducer(edited, { type: 'clear' })).toEqual({});
  });

  it('drops the draft after a save that matches it', () => {
    const edited = edit({}, 'subject', 'Saved subject');
    const sent = edited[key]!;
    const saved = sent.map((variant) => ({ ...variant }));

    const state = draftsReducer(edited, { type: 'saved', key, sent, saved });
    expect(state[key]).toBeUndefined();
  });

  it('keeps fields typed while the save was in flight and takes the server values for the rest', () => {
    const sentState = edit({}, 'subject', 'Sent subject');
    const sent = sentState[key]!;
    const typedDuringSave = edit(sentState, 'intro', 'Typed while saving');
    // The server trims and normalises what it saves.
    const saved = sent.map((variant) => ({ ...variant, subject: variant.subject.trim() }));

    const state = draftsReducer(typedDuringSave, { type: 'saved', key, sent, saved });

    expect(state[key]?.[0]).toMatchObject({ subject: 'Sent subject', intro: 'Typed while saving' });
    expect(isDraftDirty(state[key], saved)).toBe(true);
  });
});
