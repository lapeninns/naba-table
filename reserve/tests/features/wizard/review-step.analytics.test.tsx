import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WizardDependenciesProvider } from '@features/reservations/wizard/di';
import { getInitialState } from '@features/reservations/wizard/model/reducer';
import { ReviewStep } from '@features/reservations/wizard/ui/steps/ReviewStep';

describe('<ReviewStep /> analytics', () => {
  it('tracks confirm_open with dependency-provided analytics', () => {
    const track = vi.fn();
    const state = getInitialState({
      date: '2025-05-10',
      time: '19:30',
      party: 3,
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: '07123456789',
    });
    state.step = 3;

    render(
      <WizardDependenciesProvider value={{ analytics: { track } }}>
        <ReviewStep
          state={state}
          actions={{ goToStep: vi.fn() }}
          onConfirm={vi.fn()}
          onActionsChange={vi.fn()}
        />
      </WizardDependenciesProvider>,
    );

    expect(track).toHaveBeenCalledWith(
      'confirm_open',
      expect.objectContaining({
        date: '2025-05-10',
        time: '19:30',
        party: 3,
      }),
    );
  });
});
