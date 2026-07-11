import { describe, expect, it } from 'vitest';

import { groupActions } from '@features/reservations/wizard/utils/groupActions';

import type { StepAction } from '@features/reservations/wizard/model/reducer';

function makeAction(id: string, role?: StepAction['role']): StepAction {
  return { id, label: id, onClick: () => {}, role };
}

describe('groupActions', () => {
  it('returns empty groups for no actions @contract', () => {
    expect(groupActions([])).toEqual({ primary: [], secondary: [], support: [] });
  });

  it('respects explicit roles @contract', () => {
    const primary = makeAction('confirm', 'primary');
    const secondary = makeAction('edit', 'secondary');
    const support = makeAction('help', 'support');

    const grouped = groupActions([support, secondary, primary]);

    expect(grouped.primary).toEqual([primary]);
    expect(grouped.secondary).toEqual([secondary]);
    expect(grouped.support).toEqual([support]);
  });

  it('defaults the last unroled action to primary and earlier ones to secondary @contract', () => {
    const back = makeAction('back');
    const next = makeAction('next');

    const grouped = groupActions([back, next]);

    expect(grouped.primary).toEqual([next]);
    expect(grouped.secondary).toEqual([back]);
  });

  it('promotes the last secondary when no primary exists @contract', () => {
    const back = makeAction('back', 'secondary');
    const skip = makeAction('skip', 'secondary');

    const grouped = groupActions([back, skip]);

    expect(grouped.primary).toEqual([skip]);
    expect(grouped.secondary).toEqual([back]);
  });

  it('keeps a single unroled action as the primary CTA @contract @smoke', () => {
    const solo = makeAction('continue');
    const grouped = groupActions([solo]);

    expect(grouped.primary).toEqual([solo]);
    expect(grouped.secondary).toEqual([]);
  });

  it('never promotes support actions @contract', () => {
    const help = makeAction('help', 'support');
    const grouped = groupActions([help]);

    expect(grouped.primary).toEqual([]);
    expect(grouped.support).toEqual([help]);
  });
});
