import { describe, expect, it } from 'vitest';

import { floorPlanBody } from '@/components/features/floor-plan/model/floorPlanView';

describe('floorPlanBody', () => {
  it('shows the service floor plan as a list on phones and when the list is on', () => {
    expect(floorPlanBody({ mode: 'service', view: 'plan', listOn: false, phone: true })).toBe(
      'list',
    );
    expect(floorPlanBody({ mode: 'service', view: 'plan', listOn: true, phone: false })).toBe(
      'list',
    );
    expect(floorPlanBody({ mode: 'service', view: 'plan', listOn: false, phone: false })).toBe(
      'canvas',
    );
    expect(floorPlanBody({ mode: 'service', view: 'timeline', listOn: false, phone: true })).toBe(
      'timeline',
    );
  });

  it('keeps the layout canvas on phones, since the list cannot move tables', () => {
    expect(floorPlanBody({ mode: 'arrange', view: 'plan', listOn: true, phone: false })).toBe(
      'list',
    );
    expect(floorPlanBody({ mode: 'arrange', view: 'plan', listOn: false, phone: true })).toBe(
      'canvas',
    );
    expect(floorPlanBody({ mode: 'arrange', view: 'timeline', listOn: false, phone: true })).toBe(
      'canvas',
    );
  });
});
